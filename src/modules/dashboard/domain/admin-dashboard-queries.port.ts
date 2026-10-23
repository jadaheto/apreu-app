/** Sum of applied payments and how many there were. */
export interface RevenueTotal {
  total: number;
  count: number;
}

export interface OverdueTotal {
  /** Pending balance of overdue charges. */
  total: number;
  /** Students with at least one overdue charge with balance. */
  debtors: number;
}

export interface StudentCounts {
  active: number;
  total: number;
}

export interface MonthlyRevenueRow {
  /** `YYYY-MM` */
  month: string;
  total: number;
}

export interface LevelCount {
  level: string;
  total: number;
}

export interface RecentPaymentRow {
  paymentId: number;
  receiptNumber: string | null;
  amount: number;
  method: string | null;
  /** `YYYY-MM-DD HH:mm:ss` (school local time). */
  paidAt: string | null;
  studentId: number;
  studentName: string;
  studentCode: string;
}

export interface DebtorRow {
  studentId: number;
  studentName: string;
  studentCode: string;
  gradeName: string | null;
  balance: number;
  /** `YYYY-MM-DD` */
  oldestDueDate: string;
}

/**
 * Read-only aggregates over tables owned by finance, students, academic, HR
 * and incidents. Kept as a dedicated port of the dashboard (CQRS read model)
 * so the dashboard never imports other contexts. Dates are school-local
 * `YYYY-MM-DD` days; ranges are `[from, toExclusive)`.
 *
 * Shared formulas (analysis 01 rule 11): revenue counts only `applied`
 * payments; a charge balance is `net_amount − Σ applications of non reversed
 * payments`; a charge is overdue when `due_date < today`, its status is
 * `pending|partial|overdue` and its balance is positive.
 */
export interface AdminDashboardQueriesPort {
  revenueBetween(from: string, toExclusive: string): Promise<RevenueTotal>;
  monthlyRevenue(from: string, toExclusive: string): Promise<MonthlyRevenueRow[]>;
  overdueSummary(today: string): Promise<OverdueTotal>;
  topDebtors(today: string, limit: number): Promise<DebtorRow[]>;
  recentPayments(limit: number): Promise<RecentPaymentRow[]>;
  studentCounts(): Promise<StudentCounts>;
  activeStudentsByLevel(): Promise<LevelCount[]>;
  activeEmployees(): Promise<number>;
  pendingIncidents(): Promise<number>;
  /** `settings.academic_year`, `null` when unset or invalid. */
  academicYear(): Promise<number | null>;
}

export const ADMIN_DASHBOARD_QUERIES = Symbol('AdminDashboardQueriesPort');
