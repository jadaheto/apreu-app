import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { Calendar } from '../domain/calendar.js';
import {
  DASHBOARD_QUERIES,
  type CategoryTotal,
  type DashboardQueriesPort,
  type InvoiceSummary,
} from './ports/dashboard-queries.port.js';

export interface KpiView {
  value: number;
  previous: number;
  /** % change vs previous month with one decimal; null when the previous value is ≤ 0. */
  changePct: number | null;
}

export interface FinanceDashboardView {
  month: string;
  income: KpiView;
  expenses: KpiView;
  /** Income − expenses (cash basis). */
  netProfit: number;
  overduePortfolio: { balance: number; debtors: number };
  chargesByCategory: CategoryTotal[];
  topExpenseCategories: CategoryTotal[];
  latestInvoices: InvoiceSummary[];
}

const TOP_EXPENSE_CATEGORIES = 5;
const LATEST_INVOICES = 5;

/** Legacy `pctChange`: `((curr − prev) / prev) × 100`, empty when `prev ≤ 0`. */
export const percentChange = (previous: number, current: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

/**
 * Financial KPIs of a month (legacy `finance/index.php`): income vs expenses
 * with change against the previous month, net result, overdue portfolio,
 * charges billed by category, top expense categories (computed but never
 * shown in legacy, bug B19) and latest invoices with the right columns (bug B18).
 */
@Injectable()
export class GetFinanceDashboardUseCase implements UseCase<{ month?: string }, FinanceDashboardView> {
  constructor(
    @Inject(DASHBOARD_QUERIES) private readonly queries: DashboardQueriesPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ month }: { month?: string }): Promise<FinanceDashboardView> {
    const today = Calendar.today(this.clock.now());
    const period = month ? BillingPeriod.create(month) : BillingPeriod.fromDate(today);
    const previous = period.previous();
    const [from, to, prevFrom] = [period.firstDay(), period.next().firstDay(), previous.firstDay()];

    const [income, prevIncome, expenses, prevExpenses, overdue, byCategory, topExpenses, invoices] = await Promise.all([
      this.queries.income(from, to),
      this.queries.income(prevFrom, from),
      this.queries.expenses(from, to),
      this.queries.expenses(prevFrom, from),
      this.queries.overduePortfolio(today),
      this.queries.chargesByCategory(from, to),
      this.queries.topExpenseCategories(from, to, TOP_EXPENSE_CATEGORIES),
      this.queries.latestInvoices(LATEST_INVOICES),
    ]);

    return {
      month: period.toString(),
      income: { value: income, previous: prevIncome, changePct: percentChange(prevIncome, income) },
      expenses: { value: expenses, previous: prevExpenses, changePct: percentChange(prevExpenses, expenses) },
      netProfit: Math.round((income - expenses) * 100) / 100,
      overduePortfolio: overdue,
      chargesByCategory: byCategory,
      topExpenseCategories: topExpenses,
      latestInvoices: invoices,
    };
  }
}
