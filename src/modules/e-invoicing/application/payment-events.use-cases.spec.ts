import type { ChargeTaxPort } from '../domain/charge-tax.port.js';
import type { PayerData, PayerDirectoryPort } from '../domain/payer-directory.port.js';
import { dianResponse, issuerConfig } from '../testing/fixtures.js';
import { createHarness, type Harness } from '../testing/harness.js';
import { CreditVoidedPaymentUseCase } from './credit-voided-payment.use-case.js';
import type { PaymentRegisteredPayload } from './integration-events.js';
import { InvoiceRegisteredPaymentUseCase } from './invoice-registered-payment.use-case.js';

const payment: PaymentRegisteredPayload = {
  paymentId: 501,
  receiptNumber: 'RC-0001',
  studentId: 7,
  totalAmount: 469000,
  method: 'transferencia',
  paidAt: '2026-03-15T09:00:00-05:00',
  appliedCharges: [
    { studentChargeId: 1, conceptId: 10, conceptName: 'Pensión marzo', amount: 350000 },
    { studentChargeId: 2, conceptId: 20, conceptName: 'Uniforme', amount: 119000 },
  ],
};

const guardian: PayerData = {
  name: 'Luis Pérez',
  firstName: 'Luis',
  familyName: 'Pérez',
  idType: '13',
  idNumber: '72000111',
  email: 'luis@example.com',
  phone: null,
  address: 'Calle 9',
};

describe('automatic invoicing from finance events', () => {
  let h: Harness;
  let payer: PayerData | null;
  const payers: PayerDirectoryPort = { findPayerOfStudent: async () => payer };
  const taxes: ChargeTaxPort = { taxRatesOf: async () => new Map([[2, 19]]) };
  const invoicePayment = () =>
    new InvoiceRegisteredPaymentUseCase(h.configs, h.documents, payers, taxes, h.executor, h.issuer, h.submitter);
  const creditVoided = () => new CreditVoidedPaymentUseCase(h.configs, h.documents, h.executor, h.issuer, h.submitter);

  beforeEach(() => {
    h = createHarness({ config: issuerConfig({ autoInvoiceOnPayment: true }) });
    payer = guardian;
  });

  it('does nothing when automatic invoicing is disabled', async () => {
    h.configs.config = issuerConfig();
    await expect(invoicePayment().execute(payment)).resolves.toEqual({
      status: 'skipped',
      reason: 'AUTO_INVOICING_DISABLED',
    });
    await expect(
      creditVoided().execute({ paymentId: 501, receiptNumber: 'RC-0001', reason: 'x' }),
    ).resolves.toMatchObject({ status: 'skipped' });
    expect(h.documents.store.all()).toHaveLength(0);
  });

  it('issues one cash invoice per payment to the guardian and sends it in background', async () => {
    const result = await invoicePayment().execute(payment);
    expect(result).toEqual({ status: 'issued', documentId: 1, number: 'SETP990000001' });

    const invoice = (await h.documents.findById(1))!;
    expect(invoice).toMatchObject({ status: 'signed', sourcePaymentId: 501, notes: 'Recibo de caja RC-0001' });
    expect(invoice.paymentMeans).toEqual({ form: '1', code: '47', dueDate: null });
    expect(invoice.customer).toMatchObject({
      name: 'Luis Pérez',
      idNumber: '72000111',
      personType: '2',
      firstName: 'Luis',
    });
    expect(invoice.lines.map((l) => [l.description, l.taxTreatment, l.lineTotalCents, l.taxCents])).toEqual([
      ['Pensión marzo', 'excluded', 35_000_000, 0],
      ['Uniforme', 'taxed', 10_000_000, 1_900_000],
    ]);
    expect(invoice.totals.payableCents).toBe(46_900_000);
    expect(h.gateway.calls).toHaveLength(0);

    await h.executor.flush();
    expect((await h.documents.findById(1))!.status).toBe('accepted');
    expect(h.events.published[0].payload).toMatchObject({ paymentId: 501, total: 469000 });
  });

  it('is idempotent per payment', async () => {
    await invoicePayment().execute(payment);
    await expect(invoicePayment().execute(payment)).resolves.toEqual({ status: 'skipped', reason: 'ALREADY_INVOICED' });
  });

  it('invoices the final consumer when the payer is unknown and maps unknown methods to "1"', async () => {
    payer = null;
    await invoicePayment().execute({ ...payment, method: 'otro', appliedCharges: [] });
    const invoice = (await h.documents.findById(1))!;
    expect(invoice.customer).toMatchObject({ name: 'Consumidor Final', idNumber: '222222222222' });
    expect(invoice.paymentMeans.code).toBe('1');
    expect(invoice.lines[0]).toMatchObject({ description: 'Pago recibo RC-0001', lineTotalCents: 46_900_000 });
  });

  it('annuls the accepted invoice of a voided payment with a credit note', async () => {
    await invoicePayment().execute(payment);
    await h.executor.flush();

    const result = await creditVoided().execute({ paymentId: 501, receiptNumber: 'RC-0001', reason: 'Pago duplicado' });
    expect(result).toMatchObject({ status: 'issued', number: 'NC990000001' });
    await h.executor.flush();
    const note = (await h.documents.findById(result.status === 'issued' ? result.documentId : 0))!;
    expect(note).toMatchObject({
      type: 'nc',
      status: 'accepted',
      sourcePaymentId: 501,
      discrepancy: { code: '2' },
      notes: 'Anulación del recibo RC-0001: Pago duplicado',
    });
    expect(note.totals.payableCents).toBe(46_900_000);

    await expect(creditVoided().execute({ paymentId: 501, receiptNumber: 'RC-0001', reason: 'x' })).resolves.toEqual({
      status: 'skipped',
      reason: 'ALREADY_CREDITED',
    });
  });

  it('skips voided payments without an accepted invoice', async () => {
    await expect(creditVoided().execute({ paymentId: 999, receiptNumber: 'X', reason: 'x' })).resolves.toEqual({
      status: 'skipped',
      reason: 'NOT_INVOICED',
    });
    h.gateway.willRespond(dianResponse({ statusCode: '99', isValid: false }));
    await invoicePayment().execute(payment);
    await h.executor.flush();
    await expect(creditVoided().execute({ paymentId: 501, receiptNumber: 'RC-0001', reason: 'x' })).resolves.toEqual({
      status: 'skipped',
      reason: 'INVOICE_NOT_ACCEPTED',
    });
  });
});
