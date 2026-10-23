import { Injectable } from '@nestjs/common';
import { toOffset, type Paginated, type PageRequest } from '../../../../../shared/domain/pagination.js';
import { SqlParams, unaccentLike } from '../../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  ChargeListItem,
  ChargeQueriesPort,
  ChargeSearchCriteria,
  ChargeSummaryRow,
  CollectibleCharge,
} from '../../../application/ports/charge-queries.port.js';
import type { BillingPeriod } from '../../../domain/billing-period.vo.js';
import type { ChargeStatus } from '../../../domain/student-charge.js';
import { chargeInPeriodSql, chargePeriodSql, likePattern, num, OPEN_STATUSES_SQL, PAID_BY_CHARGE } from '../sql.js';

const FROM_CHARGES = `
  FROM student_charges sc
  INNER JOIN students s ON s.id = sc.student_id
  INNER JOIN billing_concepts bc ON bc.id = sc.concept_id
  LEFT JOIN ${PAID_BY_CHARGE} pd ON pd.charge_id = sc.id`;

const PENDING_SQL = 'sc.net_amount - COALESCE(pd.paid, 0)';
const OPEN_STATUSES = ['pending', 'partial', 'overdue'];

/** SQL read model over `student_charges` with derived paid/pending amounts. */
@Injectable()
export class SqlChargeQueries implements ChargeQueriesPort {
  constructor(private readonly db: TenantDataSource) {}

  async search(criteria: ChargeSearchCriteria, page: PageRequest): Promise<Paginated<ChargeListItem>> {
    const where: string[] = ['1 = 1'];
    const params = new SqlParams();
    if (criteria.studentId) where.push(`sc.student_id = ${params.add(criteria.studentId)}`);
    if (criteria.conceptId) where.push(`sc.concept_id = ${params.add(criteria.conceptId)}`);
    if (criteria.status) where.push(`sc.status = ${params.add(criteria.status)}`);
    if (criteria.period) {
      const [year, month] = criteria.period.split('-').map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      where.push(
        chargeInPeriodSql('sc', params, { period: criteria.period, firstDay: `${criteria.period}-01`, lastDay }),
      );
    }
    if (criteria.overdueOnly) {
      where.push(
        `sc.status IN ${OPEN_STATUSES_SQL} AND sc.due_date < ${params.add(criteria.today)} AND ${PENDING_SQL} > 0`,
      );
    }
    if (criteria.search?.trim()) {
      const like = params.add(likePattern(criteria.search));
      where.push(
        `(${unaccentLike("s.first_name || ' ' || s.last_name", like)} OR ${unaccentLike('s.code', like)} OR ${unaccentLike('s.document_number', like)})`,
      );
    }
    const manager = await this.db.manager();
    const filter = `${FROM_CHARGES} WHERE ${where.join(' AND ')}`;
    const [{ total }] = await manager.query(`SELECT COUNT(*)::int AS total ${filter}`, params.values);
    const limit = params.add(page.limit);
    const offset = params.add(toOffset(page));
    const rows = await manager.query(
      `SELECT sc.id, sc.student_id AS "studentId", concat_ws(' ', s.first_name, s.last_name) AS "studentName",
              s.code AS "studentCode", sc.concept_id AS "conceptId", bc.name AS "conceptName", bc.category AS "conceptCategory",
              sc.description, ${chargePeriodSql('sc')} AS period, sc.net_amount AS "netAmount",
              COALESCE(pd.paid, 0) AS "paidAmount", to_char(sc.due_date, 'YYYY-MM-DD') AS "dueDate", sc.status
       ${filter}
       ORDER BY sc.due_date DESC, sc.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params.values,
    );
    return {
      items: rows.map((row: Record<string, unknown>) => this.toItem(row, criteria.today)),
      total: num(total),
      page: page.page,
      limit: page.limit,
    };
  }

  async summary(limit: number): Promise<ChargeSummaryRow[]> {
    const rows: Record<string, unknown>[] = await (
      await this.db.manager()
    ).query(
      `SELECT sc.concept_id AS "conceptId", bc.name AS "conceptName", ${chargePeriodSql('sc')} AS period,
              COUNT(*)::int AS "chargesCount", SUM(sc.net_amount) AS "totalNet",
              SUM(LEAST(COALESCE(pd.paid, 0), sc.net_amount)) AS "totalPaid", COUNT(*) FILTER (WHERE sc.status = 'paid')::int AS "paidCount"
       ${FROM_CHARGES}
       WHERE sc.status <> 'cancelled'
       GROUP BY sc.concept_id, bc.name, period
       ORDER BY period DESC, bc.name ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({
      conceptId: num(row.conceptId),
      conceptName: String(row.conceptName),
      period: String(row.period),
      chargesCount: num(row.chargesCount),
      totalNet: num(row.totalNet),
      totalPaid: num(row.totalPaid),
      paidCount: num(row.paidCount),
    }));
  }

  async collectibleForPeriod(period: BillingPeriod): Promise<CollectibleCharge[]> {
    const params = new SqlParams();
    const inPeriod = chargeInPeriodSql('sc', params, {
      period: period.toString(),
      firstDay: period.firstDay(),
      lastDay: period.lastDay(),
    });
    const rows: Record<string, unknown>[] = await (
      await this.db.manager()
    ).query(
      `SELECT sc.id AS "chargeId", sc.student_id AS "studentId", s.document_number AS "documentNumber",
              ${PENDING_SQL} AS "pendingAmount"
       ${FROM_CHARGES}
       WHERE sc.status IN ${OPEN_STATUSES_SQL} AND ${inPeriod} AND ${PENDING_SQL} > 0
       ORDER BY s.last_name, s.first_name, sc.id`,
      params.values,
    );
    return rows.map((row) => ({
      chargeId: num(row.chargeId),
      studentId: num(row.studentId),
      documentNumber: (row.documentNumber as string | null) ?? null,
      pendingAmount: num(row.pendingAmount),
    }));
  }

  private toItem(row: Record<string, unknown>, today: string): ChargeListItem {
    const status = row.status as ChargeStatus;
    const netAmount = num(row.netAmount);
    const paidAmount = num(row.paidAmount);
    const pendingAmount = status === 'cancelled' ? 0 : Math.max(Math.round((netAmount - paidAmount) * 100) / 100, 0);
    const dueDate = String(row.dueDate);
    return {
      id: num(row.id),
      studentId: num(row.studentId),
      studentName: String(row.studentName),
      studentCode: String(row.studentCode),
      conceptId: num(row.conceptId),
      conceptName: String(row.conceptName),
      conceptCategory: String(row.conceptCategory ?? 'otro'),
      description: String(row.description),
      period: String(row.period),
      netAmount,
      paidAmount,
      pendingAmount,
      dueDate,
      status,
      isOverdue: OPEN_STATUSES.includes(status) && pendingAmount > 0 && dueDate < today,
    };
  }
}
