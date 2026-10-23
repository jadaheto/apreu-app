import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  PAYROLL_PAYMENT_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollPaymentRepository,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { loadPeriod } from './load-period.js';
import { toPayrollPeriodView, type PayrollPeriodView } from './payroll-views.js';

export interface CancelPayrollPeriodInput {
  periodId: number;
  reason: string;
}

/** Cancels a DRAFT/CALCULATED period with a reason; payslips are kept as cancelled, never deleted. */
@Injectable()
export class CancelPayrollPeriodUseCase implements UseCase<CancelPayrollPeriodInput, PayrollPeriodView> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute({ periodId, reason }: CancelPayrollPeriodInput): Promise<PayrollPeriodView> {
    return this.uow.runInTransaction(async () => {
      const period = await loadPeriod(this.periods, periodId);
      period.cancel(reason, this.clock.now());
      const payslips = await this.payments.findByPeriod(periodId);
      payslips.forEach((payslip) => payslip.cancel());
      await this.payments.saveAll(payslips);
      await this.periods.save(period);
      return toPayrollPeriodView(period);
    });
  }
}
