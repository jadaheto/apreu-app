import { RecordingEventBus } from '../../../../shared/testing/fakes.js';
import type { PostExpenseEntryUseCase } from '../../application/post-expense-entry.use-case.js';
import type { PostPaymentEntryUseCase } from '../../application/post-payment-entry.use-case.js';
import type { PostPayrollEntryUseCase } from '../../application/post-payroll-entry.use-case.js';
import type { ReversePaymentEntryUseCase } from '../../application/reverse-payment-entry.use-case.js';
import { AccountingEventSubscriber } from './accounting-event-subscriber.js';

describe('AccountingEventSubscriber', () => {
  it('routes each subscribed event to its use case', async () => {
    const bus = new RecordingEventBus();
    const useCase = () => ({ execute: vi.fn().mockResolvedValue({ status: 'posted' }) });
    const [payment, voided, expense, payroll] = [useCase(), useCase(), useCase(), useCase()];
    new AccountingEventSubscriber(
      bus,
      payment as unknown as PostPaymentEntryUseCase,
      voided as unknown as ReversePaymentEntryUseCase,
      expense as unknown as PostExpenseEntryUseCase,
      payroll as unknown as PostPayrollEntryUseCase,
    ).subscribe();
    const occurredAt = new Date('2026-03-31T20:00:00Z');
    const publish = (name: string, payload: object) => bus.publish({ name, occurredAt, payload });

    await publish('finance.payment-registered', { paymentId: 1 });
    await publish('finance.payment-voided', { paymentId: 1 });
    await publish('finance.expense-registered', { expenseId: 2 });
    await publish('hr.payroll-period-paid', { periodId: 3 });

    expect(payment.execute).toHaveBeenCalledWith({ paymentId: 1 });
    expect(voided.execute).toHaveBeenCalledWith({ paymentId: 1 });
    expect(expense.execute).toHaveBeenCalledWith({ expenseId: 2 });
    expect(payroll.execute).toHaveBeenCalledWith({ payroll: { periodId: 3 }, paidAt: occurredAt });
  });
});
