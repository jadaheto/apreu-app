import type {
  AdminDashboardQueriesPort,
  DebtorRow,
  LevelCount,
  MonthlyRevenueRow,
  RecentPaymentRow,
} from '../domain/admin-dashboard-queries.port.js';

/** Canned answers; records every call so tests can assert ranges and skipped queries. */
export class StubAdminDashboardQueries implements AdminDashboardQueriesPort {
  readonly calls: { method: string; args: unknown[] }[] = [];
  revenue = new Map<string, { total: number; count: number }>();
  monthly: MonthlyRevenueRow[] = [];
  debtors: DebtorRow[] = [];
  payments: RecentPaymentRow[] = [];
  levels: LevelCount[] = [];
  year: number | null = 2026;

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }

  async revenueBetween(from: string, toExclusive: string) {
    this.record('revenueBetween', from, toExclusive);
    return this.revenue.get(from) ?? { total: 0, count: 0 };
  }
  async monthlyRevenue(from: string, toExclusive: string) {
    this.record('monthlyRevenue', from, toExclusive);
    return this.monthly;
  }
  async overdueSummary(today: string) {
    this.record('overdueSummary', today);
    return { total: 1_500_000, debtors: 3 };
  }
  async topDebtors(today: string, limit: number) {
    this.record('topDebtors', today, limit);
    return this.debtors;
  }
  async recentPayments(limit: number) {
    this.record('recentPayments', limit);
    return this.payments;
  }
  async studentCounts() {
    this.record('studentCounts');
    return { active: 120, total: 130 };
  }
  async activeStudentsByLevel() {
    this.record('activeStudentsByLevel');
    return this.levels;
  }
  async activeEmployees() {
    this.record('activeEmployees');
    return 25;
  }
  async pendingIncidents() {
    this.record('pendingIncidents');
    return 4;
  }
  async academicYear() {
    this.record('academicYear');
    return this.year;
  }
}
