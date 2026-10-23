import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  EVENT_BUS,
  type EventBusPort,
  type IntegrationEvent,
} from '../../../../shared/application/ports/event-bus.port.js';
import { PAYROLL_PERIOD_PAID, type PayrollPeriodPaidPayload } from '../../application/integration-events.js';
import { RecordPayrollExpenseUseCase } from '../../application/record-payroll-expense.use-case.js';

/** Registers the payroll expense when HR publishes `hr.payroll-period-paid`. */
@Injectable()
export class PayrollPeriodPaidSubscriber implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    private readonly recordPayrollExpense: RecordPayrollExpenseUseCase,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(PAYROLL_PERIOD_PAID, async (event: IntegrationEvent<PayrollPeriodPaidPayload>) => {
      await this.recordPayrollExpense.execute(event.payload);
    });
  }
}
