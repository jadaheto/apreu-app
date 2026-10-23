import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import type { LeaveRequest } from '../../domain/leaves/leave-request.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import { AbsenceDaysCalculator } from '../../domain/payroll/absence-days.js';
import { PayrollCalculator } from '../../domain/payroll/payroll-calculator.js';
import type { PayrollNovelty } from '../../domain/payroll/payroll-novelty.js';
import { PayrollPayment, sumPayrollTotals } from '../../domain/payroll/payroll-payment.js';
import {
  PAYROLL_NOVELTY_REPOSITORY,
  PAYROLL_PAYMENT_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollNoveltyRepository,
  type PayrollPaymentRepository,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { loadPeriod } from './load-period.js';
import { PayrollParametersProvider } from './payroll-parameters.provider.js';
import { toPayrollPeriodView, type PayrollPeriodView } from './payroll-views.js';

export interface CalculatePayrollPeriodInput {
  actor: AuthenticatedActor;
  periodId: number;
}

export interface CalculatePayrollPeriodOutput {
  period: PayrollPeriodView;
  payslips: number;
  /** Deduction adjustments and ignored novelties, per employee. */
  warnings: { employeeId: number; messages: string[] }[];
}

/**
 * Liquidates (or re-liquidates) a DRAFT/CALCULATED period atomically
 * (fixes B-8: the legacy wrote partial payslips without a transaction).
 *
 * Eligible employees: not contractors (L-12), active or on leave (L-13), and
 * retired ones up to their retirement date; days are prorated by hire and
 * retirement dates (L-14). Approved leaves and the period novelties feed the
 * {@link PayrollCalculator} with the parameters of the period's year.
 */
@Injectable()
export class CalculatePayrollPeriodUseCase implements UseCase<
  CalculatePayrollPeriodInput,
  CalculatePayrollPeriodOutput
> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(PAYROLL_NOVELTY_REPOSITORY) private readonly novelties: PayrollNoveltyRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly parameters: PayrollParametersProvider,
  ) {}

  execute({ actor, periodId }: CalculatePayrollPeriodInput): Promise<CalculatePayrollPeriodOutput> {
    return this.uow.runInTransaction(async () => {
      const period = await loadPeriod(this.periods, periodId);
      period.ensureEditable();
      const params = await this.parameters.forYear(period.year);
      const { startDate, endDate, frequency } = period;

      const candidates = await this.employees.findPayrollCandidates(startDate, endDate);
      const eligible = candidates
        .map((employee) => ({ employee, window: employee.payrollWindow(startDate, endDate) }))
        .filter((x): x is typeof x & { window: NonNullable<typeof x.window> } => x.window !== null)
        .map((x) => ({ ...x, contractDays: CalendarDate.commercialDaysInclusive(x.window.from, x.window.to) }))
        .filter((x) => x.contractDays > 0);
      if (eligible.length === 0) {
        throw new BusinessRuleViolationError(
          'No hay empleados para liquidar en este período.',
          'NO_ELIGIBLE_EMPLOYEES',
        );
      }

      const ids = eligible.map((x) => x.employee.id as number);
      const leavesByEmployee = groupBy(await this.leaves.findApprovedInRange(ids, startDate, endDate));
      const noveltiesByEmployee = groupBy(await this.novelties.findByPeriod(periodId));
      const warnings: CalculatePayrollPeriodOutput['warnings'] = [];

      const payslips = eligible.map(({ employee, window, contractDays }) => {
        const employeeId = employee.id as number;
        const absences = AbsenceDaysCalculator.forWindow(window, contractDays, leavesByEmployee.get(employeeId) ?? []);
        const calculation = PayrollCalculator.calculate(
          employee,
          { frequency, contractDays, absences },
          noveltiesByEmployee.get(employeeId) ?? [],
          params,
        );
        if (calculation.notes.length) warnings.push({ employeeId, messages: calculation.notes });
        return PayrollPayment.fromCalculation(periodId, employeeId, calculation);
      });

      for (const [employeeId] of noveltiesByEmployee) {
        if (!ids.includes(employeeId)) {
          warnings.push({ employeeId, messages: ['Novedad ignorada: el empleado ya no hace parte de esta nómina.'] });
        }
      }

      await this.payments.replaceForPeriod(periodId, payslips);
      const totals = sumPayrollTotals(payslips);
      period.recordCalculation(totals, actor.userId, this.clock.now());
      await this.periods.save(period);
      return { period: toPayrollPeriodView(period), payslips: payslips.length, warnings };
    });
  }
}

function groupBy<T extends LeaveRequest | PayrollNovelty>(items: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) map.set(item.employeeId, [...(map.get(item.employeeId) ?? []), item]);
  return map;
}
