import { Inject, Injectable } from '@nestjs/common';
import {
  EVENT_BUS,
  type EventBusPort,
  type IntegrationEvent,
} from '../../../../shared/application/ports/event-bus.port.js';
import {
  ACCOUNTING_SUBSCRIPTIONS,
  type ExpenseRegisteredPayload,
  type PaymentRegisteredPayload,
  type PaymentVoidedPayload,
  type PayrollPeriodPaidPayload,
} from '../../application/integration-events.js';
import { PostExpenseEntryUseCase } from '../../application/post-expense-entry.use-case.js';
import { PostPaymentEntryUseCase } from '../../application/post-payment-entry.use-case.js';
import { PostPayrollEntryUseCase } from '../../application/post-payroll-entry.use-case.js';
import { ReversePaymentEntryUseCase } from '../../application/reverse-payment-entry.use-case.js';

/**
 * Wires the integration events of finance and HR to the automatic posting
 * use cases. Registered from `AccountingModule.onModuleInit`.
 */
@Injectable()
export class AccountingEventSubscriber {
  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
    private readonly postPayment: PostPaymentEntryUseCase,
    private readonly reversePayment: ReversePaymentEntryUseCase,
    private readonly postExpense: PostExpenseEntryUseCase,
    private readonly postPayroll: PostPayrollEntryUseCase,
  ) {}

  subscribe(): void {
    this.bus.subscribe(
      ACCOUNTING_SUBSCRIPTIONS.paymentRegistered,
      async (event: IntegrationEvent<PaymentRegisteredPayload>) => {
        await this.postPayment.execute(event.payload);
      },
    );
    this.bus.subscribe(
      ACCOUNTING_SUBSCRIPTIONS.paymentVoided,
      async (event: IntegrationEvent<PaymentVoidedPayload>) => {
        await this.reversePayment.execute(event.payload);
      },
    );
    this.bus.subscribe(
      ACCOUNTING_SUBSCRIPTIONS.expenseRegistered,
      async (event: IntegrationEvent<ExpenseRegisteredPayload>) => {
        await this.postExpense.execute(event.payload);
      },
    );
    this.bus.subscribe(
      ACCOUNTING_SUBSCRIPTIONS.payrollPeriodPaid,
      async (event: IntegrationEvent<PayrollPeriodPaidPayload>) => {
        await this.postPayroll.execute({ payroll: event.payload, paidAt: event.occurredAt });
      },
    );
  }
}
