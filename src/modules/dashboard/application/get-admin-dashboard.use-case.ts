import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Role } from '../../../shared/domain/role.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { ADMIN_DASHBOARD_QUERIES, type AdminDashboardQueriesPort } from '../domain/admin-dashboard-queries.port.js';
import { Calendar } from '../domain/calendar.js';
import { classifyDebtRisk } from '../domain/debt-risk.js';
import type { AdminDashboardView, FinanceWidgets } from './admin-dashboard-view.js';

const FINANCE_VIEWERS: readonly Role[] = [Role.SUPERADMIN, Role.ADMIN, Role.FINANCE];
const HR_VIEWERS: readonly Role[] = [Role.SUPERADMIN, Role.ADMIN, Role.HR];
const CHART_MONTHS = 6;
const TABLE_ROWS = 8;

/**
 * Main back-office dashboard (legacy `admin/index.php`).
 *
 * Fixes: finance and HR can open it (legacy answered 403 on their landing
 * page, bug B1) and see only the widgets of their area (analysis 01 §5.3);
 * "today" is the Colombian day; the revenue chart has exactly 6 months with
 * Spanish labels (B16, B22); reversed payments do not reduce balances; the
 * academic year comes from settings (B13). Only the queries the role needs
 * are executed, in parallel.
 */
@Injectable()
export class GetAdminDashboardUseCase implements UseCase<Role, AdminDashboardView> {
  constructor(
    @Inject(ADMIN_DASHBOARD_QUERIES) private readonly queries: AdminDashboardQueriesPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(role: Role): Promise<AdminDashboardView> {
    const today = Calendar.localDay(this.clock.now());
    const seesHr = HR_VIEWERS.includes(role);
    const [academicYear, students, byLevel, finance, activeEmployees, pending] = await Promise.all([
      this.queries.academicYear(),
      this.queries.studentCounts(),
      this.queries.activeStudentsByLevel(),
      FINANCE_VIEWERS.includes(role) ? this.finance(today) : null,
      seesHr ? this.queries.activeEmployees() : null,
      seesHr ? this.queries.pendingIncidents() : null,
    ]);
    return {
      today,
      academicYear: academicYear ?? Number(today.slice(0, 4)),
      students: { ...students, byLevel },
      finance,
      staff: activeEmployees === null ? null : { activeEmployees },
      incidents: pending === null ? null : { pending },
    };
  }

  private async finance(today: string): Promise<FinanceWidgets> {
    const monthStart = Calendar.monthStart(today);
    const nextMonthStart = Calendar.monthStart(today, 1);
    const [todayRevenue, month, overdue, monthly, recentPayments, debtors] = await Promise.all([
      this.queries.revenueBetween(today, Calendar.addDays(today, 1)),
      this.queries.revenueBetween(monthStart, nextMonthStart),
      this.queries.overdueSummary(today),
      this.queries.monthlyRevenue(Calendar.monthStart(today, 1 - CHART_MONTHS), nextMonthStart),
      this.queries.recentPayments(TABLE_ROWS),
      this.queries.topDebtors(today, TABLE_ROWS),
    ]);
    const revenueByMonth = new Map(monthly.map((row) => [row.month, row.total]));
    return {
      todayRevenue: { amount: todayRevenue.total, payments: todayRevenue.count },
      overdue: { amount: overdue.total, debtors: overdue.debtors },
      averageTicket: {
        amount: month.count ? Money.of(month.total).multiply(1 / month.count).amount : 0,
        month: monthStart.slice(0, 7),
      },
      monthlyRevenue: Calendar.lastMonths(today, CHART_MONTHS).map((key) => ({
        month: key,
        label: Calendar.monthLabel(key),
        amount: revenueByMonth.get(key) ?? 0,
      })),
      recentPayments,
      topDebtors: debtors.map((debtor) => {
        const daysOverdue = Calendar.daysBetween(debtor.oldestDueDate, today);
        return { ...debtor, daysOverdue, risk: classifyDebtRisk(daysOverdue) };
      }),
    };
  }
}
