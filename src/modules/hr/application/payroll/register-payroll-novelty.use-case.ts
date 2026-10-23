import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { PayrollNovelty, type NoveltyType } from '../../domain/payroll/payroll-novelty.js';
import {
  PAYROLL_NOVELTY_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollNoveltyRepository,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { loadPeriod } from './load-period.js';
import { toPayrollNoveltyView, type PayrollNoveltyView } from './payroll-views.js';

export interface RegisterPayrollNoveltyInput {
  actor: AuthenticatedActor;
  periodId: number;
  employeeId: number;
  type: NoveltyType;
  amount: number;
  description?: string | null;
}

/**
 * Adds a one-off novelty (overtime value, bonus, libranza, cuota sindical,
 * embargo, other deduction) to an editable period. Novelties for employees
 * that are not part of the period are rejected instead of silently ignored
 * (legacy `payroll.php`); a calculated period goes back to draft.
 */
@Injectable()
export class RegisterPayrollNoveltyUseCase implements UseCase<RegisterPayrollNoveltyInput, PayrollNoveltyView> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(PAYROLL_NOVELTY_REPOSITORY) private readonly novelties: PayrollNoveltyRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  execute(input: RegisterPayrollNoveltyInput): Promise<PayrollNoveltyView> {
    return this.uow.runInTransaction(async () => {
      const period = await loadPeriod(this.periods, input.periodId);
      period.invalidateCalculation();
      const employee = await this.employees.findById(input.employeeId);
      if (!employee) throw new NotFoundError('Empleado', input.employeeId);
      if (!employee.payrollWindow(period.startDate, period.endDate)) {
        throw new BusinessRuleViolationError(
          'El empleado no hace parte de esta nómina (contratista, inactivo o sin contrato en el período).',
          'EMPLOYEE_NOT_IN_PAYROLL',
        );
      }
      const novelty = PayrollNovelty.create({ ...input, createdBy: input.actor.userId });
      await this.novelties.save(novelty);
      await this.periods.save(period);
      return toPayrollNoveltyView(novelty, employee.fullName);
    });
  }
}
