import type { DebtRisk } from '../domain/debt-risk.js';
import type { LevelCount, RecentPaymentRow } from '../domain/admin-dashboard-queries.port.js';

export interface MonthlyRevenuePoint {
  /** `YYYY-MM` */
  month: string;
  /** Spanish abbreviation, e.g. `ene`. */
  label: string;
  amount: number;
}

export interface DebtorView {
  studentId: number;
  studentName: string;
  studentCode: string;
  gradeName: string | null;
  balance: number;
  oldestDueDate: string;
  daysOverdue: number;
  risk: DebtRisk;
}

/** Financial widgets (superadmin, admin, finance). */
export interface FinanceWidgets {
  todayRevenue: { amount: number; payments: number };
  overdue: { amount: number; debtors: number };
  /** Average applied payment of the current month. */
  averageTicket: { amount: number; month: string };
  /** Exactly the last 6 months including the current one, zero-filled. */
  monthlyRevenue: MonthlyRevenuePoint[];
  recentPayments: RecentPaymentRow[];
  topDebtors: DebtorView[];
}

/** Admin dashboard; widgets the role may not see are `null`. */
export interface AdminDashboardView {
  /** School-local day the figures refer to. */
  today: string;
  academicYear: number;
  students: { active: number; total: number; byLevel: LevelCount[] };
  finance: FinanceWidgets | null;
  /** HR widgets (superadmin, admin, hr). */
  staff: { activeEmployees: number } | null;
  /** Pending incidents (superadmin, admin, hr). */
  incidents: { pending: number } | null;
}
