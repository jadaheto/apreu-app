import { createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import type { PaymentRegisteredPayload } from './integration-events.js';
import { PostExpenseEntryUseCase } from './post-expense-entry.use-case.js';
import { PostPaymentEntryUseCase } from './post-payment-entry.use-case.js';
import { PostPayrollEntryUseCase } from './post-payroll-entry.use-case.js';
import { ReversePaymentEntryUseCase } from './reverse-payment-entry.use-case.js';

describe('automatic posting use cases', () => {
  let f: AccountingFixture;
  let id: (code: string) => number;

  const payment: PaymentRegisteredPayload = {
    paymentId: 15,
    receiptNumber: 'REC-0015',
    studentId: 3,
    totalAmount: 500000,
    method: 'transferencia',
    paidAt: '2026-03-10T20:30:00.000Z',
    appliedCharges: [
      { studentChargeId: 1, conceptId: 1, conceptName: 'Matrícula', amount: 300000 },
      { studentChargeId: 2, conceptId: 2, conceptName: 'Pensión', amount: 150000 },
    ],
  };

  const configurePayments = async () => {
    await f.rules.save({ key: 'payment.debit.default', accountId: id('110505') });
    await f.rules.save({ key: 'payment.debit.method.transferencia', accountId: id('111005') });
    await f.rules.save({ key: 'payment.credit.concept.1', accountId: id('413501') });
    await f.rules.save({ key: 'payment.credit.default', accountId: id('413502') });
    await f.rules.save({ key: 'payment.credit.unapplied', accountId: id('2335') });
  };

  beforeEach(async () => {
    f = createAccountingFixture();
    id = await f.seedPuc();
    await f.openPeriod();
  });

  describe('PostPaymentEntryUseCase', () => {
    it('posts a receipt using specific rules first, then defaults, plus the unapplied surplus', async () => {
      await configurePayments();
      const result = await new PostPaymentEntryUseCase(f.poster).execute(payment);
      expect(result).toMatchObject({ status: 'posted', displayNumber: 'RC-000001' });
      const entry = (await f.entries.findBySource('finance.payment', '15'))!;
      expect(entry).toMatchObject({
        date: '2026-03-10',
        status: 'posted',
        createdBy: null,
        description: 'Recibo de caja REC-0015',
      });
      expect(entry.lines.map((l) => [l.accountId, l.debit.amount, l.credit.amount])).toEqual([
        [id('111005'), 500000, 0],
        [id('413501'), 0, 300000],
        [id('413502'), 0, 150000],
        [id('2335'), 0, 50000],
      ]);
    });

    it('is idempotent per payment', async () => {
      await configurePayments();
      const useCase = new PostPaymentEntryUseCase(f.poster);
      await useCase.execute(payment);
      await expect(useCase.execute(payment)).resolves.toEqual({ status: 'skipped', reason: 'ALREADY_POSTED' });
      expect(f.entries.store.all()).toHaveLength(1);
      expect(f.events.published).toEqual([]);
    });

    it('logs a warning and does not fail without parametrization', async () => {
      await expect(new PostPaymentEntryUseCase(f.poster).execute(payment)).resolves.toEqual({
        status: 'skipped',
        reason: 'MISSING_POSTING_RULE',
      });
      expect(f.log.warnings[0].message).toContain('finance.payment #15');
      expect(f.entries.store.all()).toHaveLength(0);
      expect(f.events.published).toEqual([
        {
          name: 'accounting.automatic-entry-skipped',
          occurredAt: f.clock.now(),
          payload: {
            sourceType: 'finance.payment',
            sourceId: '15',
            reason: 'MISSING_POSTING_RULE',
            message: 'No hay cuentas parametrizadas para el asiento automático.',
            missingKeys: [
              ['payment.debit.method.transferencia', 'payment.debit.default'],
              ['payment.credit.concept.1', 'payment.credit.default'],
              ['payment.credit.concept.2', 'payment.credit.default'],
              ['payment.credit.unapplied', 'payment.credit.default'],
            ],
          },
        },
      ]);
    });

    it('credits by concept category when the concept has no specific rule', async () => {
      await configurePayments();
      await f.rules.save({ key: 'payment.credit.category.pension', accountId: id('413510') });
      const charges = payment.appliedCharges.map((c) => ({
        ...c,
        conceptCategory: c.conceptId === 2 ? 'pension' : null,
      }));
      await new PostPaymentEntryUseCase(f.poster).execute({ ...payment, appliedCharges: charges });
      const entry = (await f.entries.findBySource('finance.payment', '15'))!;
      expect(entry.lines.map((l) => l.accountId)).toEqual([id('111005'), id('413501'), id('413510'), id('2335')]);
    });

    it('logs a warning when there is no open period for the date', async () => {
      await configurePayments();
      const result = await new PostPaymentEntryUseCase(f.poster).execute({ ...payment, paidAt: '2026-06-01' });
      expect(result).toEqual({ status: 'skipped', reason: 'NO_OPEN_PERIOD' });
      expect(f.log.warnings).toHaveLength(1);
      expect(f.events.published[0].payload).toMatchObject({ reason: 'NO_OPEN_PERIOD', missingKeys: [] });
    });

    it('logs a warning when a rule points to a summary account', async () => {
      await configurePayments();
      await f.rules.save({ key: 'payment.debit.method.transferencia', accountId: id('1110') });
      await expect(new PostPaymentEntryUseCase(f.poster).execute(payment)).resolves.toEqual({
        status: 'skipped',
        reason: 'ACCOUNT_NOT_TRANSACTIONAL',
      });
    });
  });

  describe('ReversePaymentEntryUseCase', () => {
    it('reverses the receipt entry once', async () => {
      await configurePayments();
      await new PostPaymentEntryUseCase(f.poster).execute(payment);
      const reverse = new ReversePaymentEntryUseCase(f.poster, f.clock);
      const voided = { paymentId: 15, receiptNumber: 'REC-0015', reason: 'Cheque devuelto' };
      await expect(reverse.execute(voided)).resolves.toMatchObject({ status: 'posted', displayNumber: 'NI-000001' });
      const reversal = (await f.entries.findBySource('finance.payment-void', '15'))!;
      expect(reversal.totalDebit.amount).toBe(500000);
      expect(reversal.lines[0].credit.amount).toBe(500000);
      await expect(reverse.execute(voided)).resolves.toEqual({ status: 'skipped', reason: 'ALREADY_POSTED' });
    });

    it('warns when the payment was never booked', async () => {
      const result = await new ReversePaymentEntryUseCase(f.poster, f.clock).execute({
        paymentId: 99,
        receiptNumber: 'X',
        reason: 'x',
      });
      expect(result).toEqual({ status: 'skipped', reason: 'ORIGINAL_ENTRY_NOT_FOUND' });
      expect(f.log.warnings).toHaveLength(1);
    });
  });

  describe('PostExpenseEntryUseCase', () => {
    const expense = {
      expenseId: 4,
      categoryId: 2,
      description: 'Resmas de papel',
      amount: 85000,
      date: '2026-03-05',
      source: 'manual',
    };

    it('posts a disbursement with category and default rules', async () => {
      await f.rules.save({ key: 'expense.debit.category.2', accountId: id('5135') });
      await f.rules.save({ key: 'expense.credit.default', accountId: id('110505') });
      await expect(new PostExpenseEntryUseCase(f.poster).execute(expense)).resolves.toMatchObject({
        status: 'posted',
        displayNumber: 'CE-000001',
      });
      const entry = (await f.entries.findBySource('finance.expense', '4'))!;
      expect(entry.lines.map((l) => l.accountId)).toEqual([id('5135'), id('110505')]);
    });

    it('skips payroll expenses, booked from the payroll event', async () => {
      await expect(new PostExpenseEntryUseCase(f.poster).execute({ ...expense, source: 'payroll' })).resolves.toEqual({
        status: 'skipped',
        reason: 'PAYROLL_EXPENSE',
      });
      expect(f.log.warnings).toHaveLength(0);
    });
  });

  describe('PostPayrollEntryUseCase', () => {
    const payroll = {
      periodId: 3,
      periodName: 'Marzo 2026',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      grossTotal: 10000000,
      deductionsTotal: 800000,
      netTotal: 9200000,
    };

    it('posts gross expense against deductions payable and net paid', async () => {
      await f.rules.save({ key: 'payroll.debit.gross', accountId: id('510506') });
      await f.rules.save({ key: 'payroll.credit.deductions', accountId: id('2370') });
      await f.rules.save({ key: 'payroll.credit.net', accountId: id('111005') });
      const result = await new PostPayrollEntryUseCase(f.poster, f.log).execute({ payroll, paidAt: f.clock.now() });
      expect(result).toMatchObject({ status: 'posted', displayNumber: 'SALA-000001' });
      const entry = (await f.entries.findBySource('hr.payroll-period', '3'))!;
      expect(entry.lines.map((l) => [l.debit.amount, l.credit.amount])).toEqual([
        [10000000, 0],
        [0, 800000],
        [0, 9200000],
      ]);
    });

    it('skips inconsistent totals with a warning', async () => {
      const result = await new PostPayrollEntryUseCase(f.poster, f.log).execute({
        payroll: { ...payroll, netTotal: 1 },
        paidAt: f.clock.now(),
      });
      expect(result).toEqual({ status: 'skipped', reason: 'PAYROLL_NOT_BALANCED' });
      expect(f.log.warnings).toHaveLength(1);
    });

    it('requires its parametrization', async () => {
      const result = await new PostPayrollEntryUseCase(f.poster, f.log).execute({ payroll, paidAt: f.clock.now() });
      expect(result).toEqual({ status: 'skipped', reason: 'MISSING_POSTING_RULE' });
    });
  });
});
