import { Injectable } from '@nestjs/common';
import { toOffset, type Paginated, type PageRequest } from '../../../../../shared/domain/pagination.js';
import { SqlParams, unaccentLike } from '../../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  PaymentListItem,
  PaymentQueriesPort,
  PaymentSearchCriteria,
  ReceiptData,
} from '../../../application/ports/payment-queries.port.js';
import type { BillingPeriod } from '../../../domain/billing-period.vo.js';
import { Calendar } from '../../../domain/calendar.js';
import type { PaymentMethod } from '../../../domain/payment-method.js';
import type { PaymentStatus } from '../../../domain/payment.js';
import { likePattern, num, PAID_BY_CHARGE } from '../sql.js';

const SELECT_PAYMENTS = `
  SELECT p.id, p.receipt_no AS "receiptNumber", p.student_id AS "studentId",
         concat_ws(' ', s.first_name, s.last_name) AS "studentName", s.code AS "studentCode", s.document_number AS "documentNumber",
         p.amount, p.payment_method AS method, p.payment_date AS "paidAt", p.status, p.reference, p.notes,
         p.bank_ref AS "bankRef", p.reconciled, p.reconciled_at AS "reconciledAt", p.void_reason AS "voidReason",
         u.name AS "cashierName"`;

const FROM_PAYMENTS = `
  FROM payments p
  INNER JOIN students s ON s.id = p.student_id
  LEFT JOIN users u ON u.id = p.cashier_id`;

const CONCEPT_SEPARATOR = '||';

/** SQL read model over `payments` and their applications. */
@Injectable()
export class SqlPaymentQueries implements PaymentQueriesPort {
  constructor(private readonly db: TenantDataSource) {}

  async search(criteria: PaymentSearchCriteria, page: PageRequest): Promise<Paginated<PaymentListItem>> {
    const where: string[] = ['1 = 1'];
    const params = new SqlParams();
    if (criteria.from) where.push(`p.payment_date >= ${params.add(criteria.from)}`);
    if (criteria.to) where.push(`p.payment_date < ${params.add(Calendar.addDays(criteria.to, 1))}`);
    if (criteria.studentId) where.push(`p.student_id = ${params.add(criteria.studentId)}`);
    if (criteria.status) where.push(`p.status = ${params.add(criteria.status)}`);
    if (criteria.method) where.push(`p.payment_method = ${params.add(criteria.method)}`);
    if (criteria.search?.trim()) {
      const like = params.add(likePattern(criteria.search));
      where.push(
        `(${unaccentLike('p.receipt_no', like)} OR ${unaccentLike("s.first_name || ' ' || s.last_name", like)} OR ${unaccentLike('s.code', like)})`,
      );
    }
    const filter = `${FROM_PAYMENTS} WHERE ${where.join(' AND ')}`;
    const manager = await this.db.manager();
    const [{ total }] = await manager.query(`SELECT COUNT(*)::int AS total ${filter}`, params.values);
    const limit = params.add(page.limit);
    const offset = params.add(toOffset(page));
    const rows = await manager.query(
      `${SELECT_PAYMENTS} ${filter} ORDER BY p.payment_date DESC, p.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params.values,
    );
    return { items: await this.withApplications(rows), total: num(total), page: page.page, limit: page.limit };
  }

  async listByStudent(studentId: number, limit: number): Promise<PaymentListItem[]> {
    const rows = await (
      await this.db.manager()
    ).query(
      `${SELECT_PAYMENTS} ${FROM_PAYMENTS} WHERE p.student_id = $1 ORDER BY p.payment_date DESC, p.id DESC LIMIT $2`,
      [studentId, limit],
    );
    return this.withApplications(rows);
  }

  async forReconciliation(period: BillingPeriod): Promise<PaymentListItem[]> {
    const rows = await (
      await this.db.manager()
    ).query(
      `${SELECT_PAYMENTS} ${FROM_PAYMENTS}
       WHERE p.status = 'applied' AND p.payment_date >= $1 AND p.payment_date < $2
       ORDER BY p.payment_date DESC, p.id DESC`,
      [period.firstDay(), period.next().firstDay()],
    );
    return this.withApplications(rows);
  }

  async findReceipt(receiptNumber: string): Promise<ReceiptData | null> {
    const manager = await this.db.manager();
    // Case-insensitive (ADR-0008): receipts are typed in search boxes (`rc-2026-000123`); an exact match wins.
    const [row] = await manager.query(
      `${SELECT_PAYMENTS} ${FROM_PAYMENTS} WHERE upper(p.receipt_no) = upper($1) ORDER BY (p.receipt_no = $1) DESC LIMIT 1`,
      [receiptNumber.trim()],
    );
    if (!row) return null;
    const lines: Record<string, unknown>[] = await manager.query(
      `SELECT pa.charge_id AS "chargeId", bc.name AS "conceptName", sc.description, pa.amount_applied AS amount,
              CASE WHEN sc.status = 'cancelled' THEN 0
                   ELSE GREATEST(sc.net_amount - COALESCE(pd.paid, 0), 0) END AS "chargePending"
       FROM payment_applications pa
       INNER JOIN student_charges sc ON sc.id = pa.charge_id
       INNER JOIN billing_concepts bc ON bc.id = sc.concept_id
       LEFT JOIN ${PAID_BY_CHARGE} pd ON pd.charge_id = sc.id
       WHERE pa.payment_id = $1
       ORDER BY pa.id`,
      [row.id],
    );
    return {
      paymentId: num(row.id),
      receiptNumber: row.receiptNumber,
      studentId: num(row.studentId),
      studentName: row.studentName,
      studentCode: row.studentCode,
      documentNumber: row.documentNumber ?? null,
      amount: num(row.amount),
      method: row.method as PaymentMethod,
      paidAt: row.paidAt,
      status: row.status as PaymentStatus,
      reference: row.reference ?? null,
      notes: row.notes ?? null,
      cashierName: row.cashierName ?? null,
      voidReason: row.voidReason ?? null,
      lines: lines.map((line) => ({
        chargeId: num(line.chargeId),
        conceptName: String(line.conceptName),
        description: String(line.description),
        amount: num(line.amount),
        chargePending: num(line.chargePending),
      })),
    };
  }

  /** Adds applied totals and the list of concepts of each payment (one extra query for the page). */
  private async withApplications(rows: Record<string, any>[]): Promise<PaymentListItem[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => num(row.id));
    const applied: Record<string, unknown>[] = await (
      await this.db.manager()
    ).query(
      `SELECT pa.payment_id AS "paymentId", SUM(pa.amount_applied) AS applied,
              string_agg(DISTINCT bc.name, '${CONCEPT_SEPARATOR}' ORDER BY bc.name) AS concepts
       FROM payment_applications pa
       INNER JOIN student_charges sc ON sc.id = pa.charge_id
       INNER JOIN billing_concepts bc ON bc.id = sc.concept_id
       WHERE pa.payment_id = ANY($1)
       GROUP BY pa.payment_id`,
      [ids],
    );
    const byPayment = new Map(applied.map((item) => [num(item.paymentId), item]));
    return rows.map((row) => {
      const application = byPayment.get(num(row.id));
      const amount = num(row.amount);
      const appliedAmount = num(application?.applied);
      const status = row.status as PaymentStatus;
      return {
        id: num(row.id),
        receiptNumber: row.receiptNumber ?? `#${row.id}`,
        studentId: num(row.studentId),
        studentName: row.studentName,
        studentCode: row.studentCode,
        amount,
        appliedAmount,
        unappliedAmount: status === 'applied' ? Math.round((amount - appliedAmount) * 100) / 100 : 0,
        method: row.method as PaymentMethod,
        paidAt: row.paidAt,
        status,
        reference: row.reference ?? null,
        bankRef: row.bankRef ?? null,
        reconciled: row.reconciled === true,
        reconciledAt: row.reconciledAt ?? null,
        cashierName: row.cashierName ?? null,
        concepts: application?.concepts ? String(application.concepts).split(CONCEPT_SEPARATOR) : [],
      };
    });
  }
}
