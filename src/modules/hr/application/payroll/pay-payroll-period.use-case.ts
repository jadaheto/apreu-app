import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
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

/** Payload of `hr.payroll-period-paid` (docs/eventos-integracion.md). */
export interface PayrollPeriodPaidPayload {
  periodId: number;
  periodName: string;
  startDate: string;
  endDate: string;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
}

/**
 * Closes an approved period as PAID (legacy `close_period`). The period and
 * all its payslips change in one transaction (fixes B-9) and, once committed,
 * `hr.payroll-period-paid` is published so finance records the payroll
 * expense and accounting the journal entry (the legacy wrote `expenses`
 * directly from HR).
 */
@Injectable()
export class PayPayrollPeriodUseCase implements UseCase<number, PayrollPeriodView> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(periodId: number): Promise<PayrollPeriodView> {
    const now = this.clock.now();
    const period = await this.uow.runInTransaction(async () => {
      const found = await loadPeriod(this.periods, periodId);
      found.markPaid(now);
      const payslips = await this.payments.findByPeriod(periodId);
      payslips.forEach((payslip) => payslip.markPaid());
      await this.payments.saveAll(payslips);
      await this.periods.save(found);
      return found;
    });

    const { totals } = period;
    await this.events.publish({
      name: 'hr.payroll-period-paid',
      occurredAt: now,
      payload: {
        periodId,
        periodName: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        grossTotal: totals.gross.amount,
        deductionsTotal: totals.deductions.amount,
        netTotal: totals.net.amount,
      } satisfies PayrollPeriodPaidPayload,
    });
    return toPayrollPeriodView(period);
  }
}
