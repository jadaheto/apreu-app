import { Account } from '../domain/account.js';
import { DEFAULT_POSTING_RULES } from '../domain/default-posting-rules.js';
import { parsePostingRuleKey } from '../domain/posting-rule.js';
import { STANDARD_PUC } from '../domain/standard-puc.js';
import { ACCOUNTANT, createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { PostPaymentEntryUseCase } from './post-payment-entry.use-case.js';
import { PostPayrollEntryUseCase } from './post-payroll-entry.use-case.js';
import { SeedDefaultPostingRulesUseCase } from './seed-default-posting-rules.use-case.js';
import { SeedStandardPucUseCase } from './seed-standard-puc.use-case.js';

describe('SeedDefaultPostingRulesUseCase', () => {
  let f: AccountingFixture;
  let useCase: SeedDefaultPostingRulesUseCase;
  const code = async (key: string) => {
    const accountId = f.rules.rules.get(key) as number;
    return (await f.accounts.findById(accountId))?.code.toString();
  };

  beforeEach(() => {
    f = createAccountingFixture();
    useCase = new SeedDefaultPostingRulesUseCase(
      new SeedStandardPucUseCase(f.accounts, f.uow),
      f.accounts,
      f.rules,
      f.uow,
    );
  });

  it('only uses valid keys and accounts of movement of the standard PUC', () => {
    for (const rule of DEFAULT_POSTING_RULES) {
      expect(parsePostingRuleKey(rule.key)).toBe(rule.key);
      expect(STANDARD_PUC.find((account) => account.code === rule.accountCode)?.isTransactional).toBe(true);
    }
  });

  it('creates the chart of accounts and every default rule on a new school, in one transaction', async () => {
    const result = await useCase.execute(ACCOUNTANT);
    expect(result).toMatchObject({ accountsInserted: STANDARD_PUC.length, kept: [], unavailable: [] });
    expect(result.created).toHaveLength(DEFAULT_POSTING_RULES.length);
    expect(f.uow.transactions).toBeGreaterThanOrEqual(1);
    await expect(code('payment.debit.method.efectivo')).resolves.toBe('110505');
    await expect(code('payment.debit.method.nequi')).resolves.toBe('111005');
    await expect(code('payment.credit.category.matricula')).resolves.toBe('413501');
    await expect(code('payroll.credit.deductions')).resolves.toBe('2370');
  });

  it('is idempotent and never overwrites the school parametrization', async () => {
    await useCase.execute(ACCOUNTANT);
    const custom = (await f.accounts.findByCode('111010')) as Account;
    await f.rules.save({ key: 'payroll.credit.net', accountId: custom.id as number });

    const again = await useCase.execute(ACCOUNTANT);
    expect(again).toMatchObject({ accountsInserted: 0, created: [], unavailable: [] });
    expect(again.kept).toHaveLength(DEFAULT_POSTING_RULES.length);
    await expect(code('payroll.credit.net')).resolves.toBe('111010');
  });

  it('reports defaults whose account is no longer a movement account', async () => {
    await new SeedStandardPucUseCase(f.accounts, f.uow).execute();
    const cash = (await f.accounts.findByCode('110505')) as Account;
    cash.changeTransactional(false);
    await f.accounts.save(cash);

    const result = await useCase.execute(ACCOUNTANT);
    expect(result.unavailable).toContainEqual({ key: 'payment.debit.default', accountCode: '110505' });
    expect(f.rules.rules.has('payment.debit.default')).toBe(false);
  });

  it('lets a new school book receipts and payroll automatically', async () => {
    await useCase.execute(ACCOUNTANT);
    await f.openPeriod();
    const receipt = await new PostPaymentEntryUseCase(f.poster).execute({
      paymentId: 1,
      receiptNumber: 'REC-1',
      studentId: 1,
      totalAmount: 400000,
      method: 'nequi',
      paidAt: '2026-03-10',
      appliedCharges: [
        { studentChargeId: 1, conceptId: 9, conceptName: 'Matrícula', conceptCategory: 'matricula', amount: 300000 },
      ],
    });
    expect(receipt).toMatchObject({ status: 'posted' });
    const entry = (await f.entries.findBySource('finance.payment', '1'))!;
    const codes = await Promise.all(
      entry.lines.map(async (l) => (await f.accounts.findById(l.accountId))?.code.toString()),
    );
    expect(codes).toEqual(['111005', '413501', '2805']);

    const payroll = await new PostPayrollEntryUseCase(f.poster, f.log).execute({
      payroll: {
        periodId: 1,
        periodName: 'Marzo',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        grossTotal: 1000,
        deductionsTotal: 80,
        netTotal: 920,
      },
      paidAt: f.clock.now(),
    });
    expect(payroll).toMatchObject({ status: 'posted' });
  });
});
