/** Total of a category. */
export interface CategoryTotal {
  category: string;
  total: number;
}

/** Electronic invoice summary (table `invoices`, written by e-invoicing). */
export interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  studentName: string | null;
  issueDate: string;
  totalAmount: number;
  status: string;
}

/**
 * Aggregations for the financial dashboard (legacy `finance/index.php`).
 * Date ranges are half-open `[from, to)` over `YYYY-MM-DD` days.
 */
export interface DashboardQueriesPort {
  /** Σ applied payments (rule RN-18). */
  income(from: string, to: string): Promise<number>;
  expenses(from: string, to: string): Promise<number>;
  /** Σ pending of overdue open charges and number of debtors. */
  overduePortfolio(today: string): Promise<{ balance: number; debtors: number }>;
  /** Σ net of charges created in the range, by concept category (accrual). */
  chargesByCategory(from: string, to: string): Promise<CategoryTotal[]>;
  topExpenseCategories(from: string, to: string, limit: number): Promise<CategoryTotal[]>;
  latestInvoices(limit: number): Promise<InvoiceSummary[]>;
}

export const DASHBOARD_QUERIES = Symbol('DashboardQueriesPort');
