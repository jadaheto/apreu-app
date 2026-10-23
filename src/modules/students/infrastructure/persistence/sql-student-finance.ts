import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  FinancialSummary,
  PaymentRecord,
  PendingCharge,
  StudentFinancePort,
} from '../../domain/student-finance.port.js';

/** Amount applied per charge of the student (`studentParam`), ignoring reversed payments. */
const appliedByCharge = (studentParam: string): string => `
  SELECT pa.charge_id, SUM(pa.amount_applied) AS applied
  FROM payment_applications pa
  JOIN payments p ON p.id = pa.payment_id AND p.status <> 'reversed'
  WHERE p.student_id = ${studentParam}
  GROUP BY pa.charge_id`;

const amount = (value: string | number | null): number => Money.of(value ?? 0).amount;

/**
 * Read-only SQL adapter over the finance tables. Fixes the legacy balance
 * (`COALESCE(SUM(net) - SUM(paid), 0)` returned 0 without payments, B6) and
 * excludes cancelled charges (B7) and reversed payments.
 */
@Injectable()
export class SqlStudentFinance implements StudentFinancePort {
  constructor(private readonly db: TenantDataSource) {}

  async summary(studentId: number, today: string): Promise<FinancialSummary> {
    const [row]: {
      charged: string | null;
      paid: string | null;
      overdue: string | null;
    }[] = await (
      await this.db.manager()
    ).query(
      `SELECT SUM(sc.net_amount) AS charged,
              SUM(COALESCE(pa.applied, 0)) AS paid,
              COUNT(*) FILTER (WHERE sc.status IN ('pending', 'partial', 'overdue') AND sc.due_date < $1)::int AS overdue
       FROM student_charges sc
       LEFT JOIN (${appliedByCharge('$2')}) pa ON pa.charge_id = sc.id
       WHERE sc.student_id = $2 AND sc.status <> 'cancelled'`,
      [today, studentId],
    );
    const charged = Money.of(row?.charged ?? 0);
    const paid = Money.of(row?.paid ?? 0);
    return {
      charged: charged.amount,
      paid: paid.amount,
      balance: charged.subtract(paid).amount,
      overdueCount: Number(row?.overdue ?? 0),
    };
  }

  async pendingCharges(studentId: number, today: string): Promise<PendingCharge[]> {
    const rows: {
      id: number;
      concept: string;
      category: string | null;
      description: string;
      due_date: string;
      net_amount: string;
      applied: string | null;
      status: string;
    }[] = await (
      await this.db.manager()
    ).query(
      `SELECT sc.id, bc.name AS concept, bc.category, sc.description, to_char(sc.due_date, 'YYYY-MM-DD') AS due_date,
              sc.net_amount, pa.applied, sc.status
       FROM student_charges sc
       JOIN billing_concepts bc ON bc.id = sc.concept_id
       LEFT JOIN (${appliedByCharge('$1')}) pa ON pa.charge_id = sc.id
       WHERE sc.student_id = $1 AND sc.status NOT IN ('paid', 'cancelled')
       ORDER BY sc.due_date, sc.id`,
      [studentId],
    );
    return rows.map((row) => {
      const net = Money.of(row.net_amount);
      const applied = Money.of(row.applied ?? 0);
      return {
        chargeId: Number(row.id),
        concept: row.concept,
        category: row.category,
        description: row.description,
        dueDate: row.due_date,
        netAmount: net.amount,
        applied: applied.amount,
        pending: net.subtract(applied).amount,
        status: row.status,
        isOverdue: row.due_date < today,
      };
    });
  }

  async payments(studentId: number, limit: number): Promise<PaymentRecord[]> {
    const rows: {
      id: number;
      receipt_no: string | null;
      amount: string;
      payment_method: string;
      payment_date: Date;
      status: string;
      reference: string | null;
      notes: string | null;
      concepts: string | null;
    }[] = await (
      await this.db.manager()
    ).query(
      `SELECT p.id, p.receipt_no, p.amount, p.payment_method, p.payment_date, p.status, p.reference, p.notes,
              string_agg(DISTINCT bc.name, E'\\n' ORDER BY bc.name) AS concepts
       FROM payments p
       LEFT JOIN payment_applications pa ON pa.payment_id = p.id
       LEFT JOIN student_charges sc ON sc.id = pa.charge_id
       LEFT JOIN billing_concepts bc ON bc.id = sc.concept_id
       WHERE p.student_id = $1 AND p.status <> 'reversed'
       GROUP BY p.id
       ORDER BY p.payment_date DESC, p.id DESC
       LIMIT $2`,
      [studentId, limit],
    );
    return rows.map((row) => ({
      paymentId: Number(row.id),
      receiptNumber: row.receipt_no,
      amount: amount(row.amount),
      method: row.payment_method,
      paidAt: new Date(row.payment_date),
      status: row.status,
      reference: row.reference,
      notes: row.notes,
      concepts: row.concepts ? row.concepts.split('\n') : [],
    }));
  }
}
