import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  AdminDashboardQueriesPort,
  DebtorRow,
  LevelCount,
  MonthlyRevenueRow,
  OverdueTotal,
  RecentPaymentRow,
  RevenueTotal,
  StudentCounts,
} from '../../domain/admin-dashboard-queries.port.js';

/** Amount applied to each charge by payments that were not reversed. */
const APPLIED_BY_CHARGE = `
  SELECT pa.charge_id, SUM(pa.amount_applied) AS paid
  FROM payment_applications pa
  JOIN payments p ON p.id = pa.payment_id AND p.status <> 'reversed'
  GROUP BY pa.charge_id`;

/**
 * FROM/WHERE of the overdue open charges with positive balance (alias `sc`;
 * balance = `sc.net_amount - COALESCE(applied.paid, 0)`). Parameter `$1`: today.
 */
const overdueCharges = (joins = ''): string => `
  FROM student_charges sc ${joins}
  LEFT JOIN (${APPLIED_BY_CHARGE}) applied ON applied.charge_id = sc.id
  WHERE sc.due_date < $1
    AND sc.status IN ('pending', 'partial', 'overdue')
    AND sc.net_amount - COALESCE(applied.paid, 0) > 0`;

const DEBTOR_JOINS = `
  JOIN students s ON s.id = sc.student_id
  LEFT JOIN classrooms c ON c.id = s.classroom_id
  LEFT JOIN grades g ON g.id = c.grade_id`;

const amount = (value: string | number | null | undefined): number => Money.of(value ?? 0).amount;

/**
 * Parameterized, read-only SQL over the tenant database. Uses plain queries
 * (no ORM entities of other contexts) to keep the dashboard decoupled.
 */
@Injectable()
export class SqlAdminDashboardQueries implements AdminDashboardQueriesPort {
  constructor(private readonly db: TenantDataSource) {}

  async revenueBetween(from: string, toExclusive: string): Promise<RevenueTotal> {
    const [row] = await this.query<{ total: string | null; count: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
       FROM payments WHERE status = 'applied' AND payment_date >= $1 AND payment_date < $2`,
      [from, toExclusive],
    );
    return { total: amount(row?.total), count: Number(row?.count ?? 0) };
  }

  async monthlyRevenue(from: string, toExclusive: string): Promise<MonthlyRevenueRow[]> {
    const rows = await this.query<{ month: string; total: string }>(
      `SELECT to_char(payment_date, 'YYYY-MM') AS month, SUM(amount) AS total
       FROM payments WHERE status = 'applied' AND payment_date >= $1 AND payment_date < $2
       GROUP BY month ORDER BY month`,
      [from, toExclusive],
    );
    return rows.map((row) => ({ month: row.month, total: amount(row.total) }));
  }

  async overdueSummary(today: string): Promise<OverdueTotal> {
    const [row] = await this.query<{ total: string | null; debtors: string }>(
      `SELECT COALESCE(SUM(sc.net_amount - COALESCE(applied.paid, 0)), 0) AS total,
              COUNT(DISTINCT sc.student_id)::int AS debtors
       ${overdueCharges()}`,
      [today],
    );
    return { total: amount(row?.total), debtors: Number(row?.debtors ?? 0) };
  }

  async topDebtors(today: string, limit: number): Promise<DebtorRow[]> {
    const rows = await this.query<{
      student_id: number;
      student_name: string;
      code: string;
      grade_name: string | null;
      balance: string;
      oldest_due: string;
    }>(
      `SELECT s.id AS student_id, concat_ws(' ', s.first_name, s.last_name) AS student_name, s.code,
              g.name AS grade_name, SUM(sc.net_amount - COALESCE(applied.paid, 0)) AS balance,
              to_char(MIN(sc.due_date), 'YYYY-MM-DD') AS oldest_due
       ${overdueCharges(DEBTOR_JOINS)}
       GROUP BY s.id, s.first_name, s.last_name, s.code, g.name
       ORDER BY balance DESC
       LIMIT $2`,
      [today, limit],
    );
    return rows.map((row) => ({
      studentId: Number(row.student_id),
      studentName: row.student_name,
      studentCode: row.code,
      gradeName: row.grade_name,
      balance: amount(row.balance),
      oldestDueDate: row.oldest_due,
    }));
  }

  async recentPayments(limit: number): Promise<RecentPaymentRow[]> {
    const rows = await this.query<{
      id: number;
      receipt_no: string | null;
      amount: string;
      payment_method: string | null;
      paid_at: string | null;
      student_id: number;
      student_name: string;
      code: string;
    }>(
      `SELECT p.id, p.receipt_no, p.amount, p.payment_method,
              to_char(p.payment_date, 'YYYY-MM-DD HH24:MI:SS') AS paid_at,
              s.id AS student_id, concat_ws(' ', s.first_name, s.last_name) AS student_name, s.code
       FROM payments p JOIN students s ON s.id = p.student_id
       WHERE p.status = 'applied'
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({
      paymentId: Number(row.id),
      receiptNumber: row.receipt_no,
      amount: amount(row.amount),
      method: row.payment_method,
      paidAt: row.paid_at,
      studentId: Number(row.student_id),
      studentName: row.student_name,
      studentCode: row.code,
    }));
  }

  async studentCounts(): Promise<StudentCounts> {
    const [row] = await this.query<{ active: string | null; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*)::int AS total FROM students`,
    );
    return { active: Number(row?.active ?? 0), total: Number(row?.total ?? 0) };
  }

  async activeStudentsByLevel(): Promise<LevelCount[]> {
    const rows = await this.query<{ level: string; total: string }>(
      `SELECT g.level, COUNT(*)::int AS total
       FROM students s JOIN classrooms c ON c.id = s.classroom_id JOIN grades g ON g.id = c.grade_id
       WHERE s.status = 'active'
       GROUP BY g.level ORDER BY total DESC, g.level`,
    );
    return rows.map((row) => ({ level: row.level, total: Number(row.total) }));
  }

  async activeEmployees(): Promise<number> {
    return this.count(`SELECT COUNT(*)::int AS total FROM employees WHERE status = 'active'`);
  }

  async pendingIncidents(): Promise<number> {
    return this.count(`SELECT COUNT(*)::int AS total FROM incidents WHERE status = 'pending'`);
  }

  async academicYear(): Promise<number | null> {
    const [row] = await this.query<{ value: string | null }>("SELECT value FROM settings WHERE key = 'academic_year'");
    const year = Number(row?.value?.trim());
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
  }

  private async count(sql: string): Promise<number> {
    const [row] = await this.query<{ total: string }>(sql);
    return Number(row?.total ?? 0);
  }

  private async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.manager()).query(sql, params);
  }
}
