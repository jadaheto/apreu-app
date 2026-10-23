import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import {
  PAYROLL_PAYMENT_REPOSITORY,
  type PayrollPaymentRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isPayrollViewer } from '../hr-access.js';
import { toPayslipSummaryView, type PayslipSummaryView } from '../payroll/payroll-views.js';

export interface ListPayslipsInput {
  actor: AuthenticatedActor;
  /** Omitted = the actor's own payslips (only released periods). */
  employeeId?: number;
  page: PageRequest;
}

/** Payslip history of an employee (HR/finance) or of the signed-in employee. */
@Injectable()
export class ListPayslipsUseCase implements UseCase<ListPayslipsInput, Paginated<PayslipSummaryView>> {
  constructor(
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, employeeId, page }: ListPayslipsInput): Promise<Paginated<PayslipSummaryView>> {
    const privileged = isPayrollViewer(actor);
    const employee = await this.currentEmployee.resolveTarget(actor, employeeId, privileged);
    const onlyReleased = employeeId === undefined || !privileged;
    return mapPage(
      await this.payments.listForEmployee(employee.id as number, onlyReleased, page),
      toPayslipSummaryView,
    );
  }
}
