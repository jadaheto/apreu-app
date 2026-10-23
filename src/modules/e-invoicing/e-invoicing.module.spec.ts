import { RecordingEventBus } from '../../shared/testing/fakes.js';
import { COMMUNICATIONS_EVENTS, FINANCE_EVENTS } from './application/integration-events.js';
import type { MarkInvoiceEmailedUseCase } from './application/mark-invoice-emailed.use-case.js';
import type { CreditVoidedPaymentUseCase } from './application/credit-voided-payment.use-case.js';
import type { InvoiceRegisteredPaymentUseCase } from './application/invoice-registered-payment.use-case.js';
import { EInvoicingModule } from './e-invoicing.module.js';

describe('EInvoicingModule', () => {
  it('subscribes to finance payment events and invoice e-mail confirmations', async () => {
    const events = new RecordingEventBus();
    const invoicePayment = { execute: vi.fn().mockResolvedValue({ status: 'skipped' }) };
    const creditVoided = { execute: vi.fn().mockResolvedValue({ status: 'skipped' }) };
    const markEmailed = { execute: vi.fn().mockResolvedValue(undefined) };
    new EInvoicingModule(
      events,
      invoicePayment as unknown as InvoiceRegisteredPaymentUseCase,
      creditVoided as unknown as CreditVoidedPaymentUseCase,
      markEmailed as unknown as MarkInvoiceEmailedUseCase,
    ).onModuleInit();

    const registered = {
      paymentId: 1,
      receiptNumber: 'RC1',
      studentId: 2,
      totalAmount: 10,
      method: 'efectivo',
      paidAt: '2026-03-15',
      appliedCharges: [],
    };
    await events.publish({ name: FINANCE_EVENTS.paymentRegistered, occurredAt: new Date(), payload: registered });
    await events.publish({
      name: FINANCE_EVENTS.paymentVoided,
      occurredAt: new Date(),
      payload: { paymentId: 1, receiptNumber: 'RC1', reason: 'x' },
    });
    expect(invoicePayment.execute).toHaveBeenCalledWith(registered);
    const emailed = { dianInvoiceId: 3, number: 'FE3', to: 'a@b.co', sentAt: '2026-03-15T10:00:00.000Z' };
    await events.publish({ name: COMMUNICATIONS_EVENTS.invoiceEmailSent, occurredAt: new Date(), payload: emailed });
    expect(markEmailed.execute).toHaveBeenCalledWith(emailed);
    expect(creditVoided.execute).toHaveBeenCalledWith({ paymentId: 1, receiptNumber: 'RC1', reason: 'x' });
  });
});
