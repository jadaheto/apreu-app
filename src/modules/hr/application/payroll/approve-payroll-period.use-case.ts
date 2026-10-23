import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Role } from '../../../../shared/domain/role.js';
import { PAYROLL_PERIOD_REPOSITORY, type PayrollPeriodRepository } from '../../domain/payroll/payroll.repositories.js';
import { loadPeriod } from './load-period.js';
import { toPayrollPeriodView, type PayrollPeriodView } from './payroll-views.js';

export interface ApprovePayrollPeriodInput {
  actor: AuthenticatedActor;
  periodId: number;
}

/**
 * Approves a calculated period, freezing its payslips and releasing them to
 * the employees. HR users are subject to segregation of duties: whoever
 * calculated the period cannot approve it (analysis §6.5).
 */
@Injectable()
export class ApprovePayrollPeriodUseCase implements UseCase<ApprovePayrollPeriodInput, PayrollPeriodView> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, periodId }: ApprovePayrollPeriodInput): Promise<PayrollPeriodView> {
    const period = await loadPeriod(this.periods, periodId);
    period.approve(actor.userId, this.clock.now(), actor.role === Role.HR);
    await this.periods.save(period);
    return toPayrollPeriodView(period);
  }
}
