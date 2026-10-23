import { ACCOUNTANT, createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { DeletePostingRuleUseCase } from './delete-posting-rule.use-case.js';
import { ListPostingRulesUseCase } from './list-posting-rules.use-case.js';
import { SetPostingRuleUseCase } from './set-posting-rule.use-case.js';

describe('posting rule use cases', () => {
  let f: AccountingFixture;
  let id: (code: string) => number;

  beforeEach(async () => {
    f = createAccountingFixture();
    id = await f.seedPuc();
  });

  it('sets, lists and deletes rules', async () => {
    const set = new SetPostingRuleUseCase(f.rules, f.accounts);
    await expect(
      set.execute({ key: 'Payment.Debit.Default', accountId: id('110505'), actor: ACCOUNTANT }),
    ).resolves.toEqual({
      key: 'payment.debit.default',
      accountId: id('110505'),
      accountCode: '110505',
      accountName: 'Caja General',
    });
    const list = await new ListPostingRulesUseCase(f.rules, f.accounts).execute();
    expect(list.rules).toHaveLength(1);
    expect(list.supportedKeys.length).toBeGreaterThan(5);
    await new DeletePostingRuleUseCase(f.rules).execute('payment.debit.default');
    expect(await f.rules.findAll()).toEqual([]);
  });

  it('validates the key and the account', async () => {
    const set = new SetPostingRuleUseCase(f.rules, f.accounts);
    await expect(set.execute({ key: 'foo', accountId: id('110505'), actor: ACCOUNTANT })).rejects.toMatchObject({
      code: 'INVALID_POSTING_RULE_KEY',
    });
    await expect(
      set.execute({ key: 'payroll.credit.net', accountId: id('1110'), actor: ACCOUNTANT }),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_TRANSACTIONAL',
    });
    await expect(set.execute({ key: 'payroll.credit.net', accountId: 999, actor: ACCOUNTANT })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
