import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  CategoryTotal,
  DashboardQueriesPort,
  InvoiceSummary,
} from '../../../application/ports/dashboard-queries.port.js';
import { num, OPEN_STATUSES_SQL, PAID_BY_CHARGE } from '../sql.js';

/** Aggregations of the financial dashboard; ranges use index-friendly comparisons (debt D6). */
@Injectable()
export class SqlDashboardQueries implements DashboardQueriesPort {
  constructor(private readonly db: TenantDataSource) {}

  async income(from: string, to: string): Promise<number> {
    return this.scalar(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
       WHERE status = 'applied' AND payment_date >= $1 AND payment_date < $2`,
      [from, to],
    );
  }

  async expenses(from: string, to: string): Promise<number> {
    return this.scalar(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE expense_date >= $1 AND expense_date < $2',
      [from, to],
    );
  }

  async overduePortfolio(today: string): Promise<{ balance: number; debtors: number }> {
    const [row] = await (
      await this.db.manager()
    ).query(
      `SELECT COALESCE(SUM(t.pending), 0) AS balance, COUNT(DISTINCT t.student_id)::int AS debtors
       FROM (
         SELECT sc.student_id, sc.net_amount - COALESCE(pd.paid, 0) AS pending
         FROM student_charges sc
         LEFT JOIN ${PAID_BY_CHARGE} pd ON pd.charge_id = sc.id
         WHERE sc.status IN ${OPEN_STATUSES_SQL} AND sc.due_date < $1
       ) t
       WHERE t.pending > 0`,
      [today],
    );
    return { balance: num(row?.balance), debtors: num(row?.debtors) };
  }

  async chargesByCategory(from: string, to: string): Promise<CategoryTotal[]> {
    return this.totals(
      `SELECT COALESCE(bc.category, 'otro') AS category, SUM(sc.net_amount) AS total
       FROM student_charges sc
       INNER JOIN billing_concepts bc ON bc.id = sc.concept_id
       WHERE sc.status <> 'cancelled' AND sc.created_at >= $1 AND sc.created_at < $2
       GROUP BY COALESCE(bc.category, 'otro')
       ORDER BY total DESC`,
      [from, to],
    );
  }

  async topExpenseCategories(from: string, to: string, limit: number): Promise<CategoryTotal[]> {
    return this.totals(
      `SELECT COALESCE(ec.name, 'Sin categoría') AS category, SUM(e.amount) AS total
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.expense_date >= $1 AND e.expense_date < $2
       GROUP BY COALESCE(ec.name, 'Sin categoría')
       ORDER BY total DESC
       LIMIT $3`,
      [from, to, limit],
    );
  }

  async latestInvoices(limit: number): Promise<InvoiceSummary[]> {
    const rows: Record<string, any>[] = await (
      await this.db.manager()
    ).query(
      `SELECT i.id, i.invoice_number AS "invoiceNumber",
              CASE WHEN s.id IS NULL THEN NULL ELSE concat_ws(' ', s.first_name, s.last_name) END AS "studentName",
              to_char(i.issue_date, 'YYYY-MM-DD') AS "issueDate", i.total_amount AS "totalAmount", i.status
       FROM invoices i
       LEFT JOIN students s ON s.id = i.student_id
       ORDER BY i.issue_date DESC, i.id DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({
      id: num(row.id),
      invoiceNumber: row.invoiceNumber,
      studentName: row.studentName ?? null,
      issueDate: row.issueDate,
      totalAmount: num(row.totalAmount),
      status: row.status,
    }));
  }

  private async scalar(sql: string, params: unknown[]): Promise<number> {
    const [row] = await (await this.db.manager()).query(sql, params);
    return num(row?.total);
  }

  private async totals(sql: string, params: unknown[]): Promise<CategoryTotal[]> {
    const rows: { category: string; total: string }[] = await (await this.db.manager()).query(sql, params);
    return rows.map((row) => ({ category: row.category, total: num(row.total) }));
  }
}
