import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import {
  PAYROLL_PAYMENT_REPOSITORY,
  type PayrollPaymentRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { toEmployeeSummaryView, type EmployeeSummaryView } from '../employees/employee-view.js';
import { toPayslipSummaryView, type PayslipSummaryView } from '../payroll/payroll-views.js';

export interface MyDashboardView {
  employee: EmployeeSummaryView;
  monthsEmployed: number;
  lastPayslip: PayslipSummaryView | null;
  pendingLeaves: number;
  approvedLeavesThisYear: number;
  absenceDaysThisYear: number;
}

/**
 * KPIs of the employee portal (`employee/index.php`, `hr/portal.php?section=reports`).
 * One rule for months employed (B-29) and real leave figures instead of the
 * hard-coded zeros (B-23). Academic widgets (groups, group director) belong
 * to the academic context.
 */
@Injectable()
export class GetMyDashboardUseCase implements UseCase<AuthenticatedActor, MyDashboardView> {
  constructor(
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<MyDashboardView> {
    const employee = await this.currentEmployee.require(actor);
    const employeeId = employee.id as number;
    const today = CalendarDate.fromInstant(this.clock.now());
    const { year } = CalendarDate.parts(today);
    const [yearStart, yearEnd] = [CalendarDate.of(year, 1, 1), CalendarDate.of(year, 12, 31)];

    const [latest, pending, approved] = await Promise.all([
      this.payments.listForEmployee(employeeId, true, { page: 1, limit: 1 }),
      this.leaves.search({ employeeId, status: 'pending' }, { page: 1, limit: 1 }),
      this.leaves.findApprovedInRange([employeeId], yearStart, yearEnd),
    ]);
    const absenceDaysThisYear = approved.reduce(
      (days, leave) =>
        days +
        CalendarDate.calendarDaysInclusive(
          CalendarDate.max(leave.startDate, yearStart),
          CalendarDate.min(leave.endDate, yearEnd),
        ),
      0,
    );
    return {
      employee: toEmployeeSummaryView(employee),
      monthsEmployed: employee.hireDate ? CalendarDate.fullMonthsBetween(employee.hireDate, today) : 0,
      lastPayslip: latest.items[0] ? toPayslipSummaryView(latest.items[0]) : null,
      pendingLeaves: pending.total,
      approvedLeavesThisYear: approved.length,
      absenceDaysThisYear,
    };
  }
}
