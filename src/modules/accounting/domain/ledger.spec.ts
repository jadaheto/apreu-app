import { Account } from './account.js';
import { Ledger } from './ledger.js';
import { parsePostingRuleKey, PostingRuleKeys } from './posting-rule.js';
import { STANDARD_PUC } from './standard-puc.js';

describe('Ledger', () => {
  const accounts = [
    ['110505', 1],
    ['111005', 2],
    ['413502', 3],
  ].map(([code, id]) => {
    const account = Account.create({
      code: code as string,
      name: `Cuenta ${code}`,
      isTransactional: true,
      parent: null,
    });
    account.assignId(id as number);
    return account;
  });

  it('builds rows with opening, movements and closing balance', () => {
    const rows = Ledger.rows(
      accounts,
      new Map([[1, { debit: 1000, credit: 0 }]]),
      new Map([
        [1, { debit: 500, credit: 200 }],
        [3, { debit: 0, credit: 300 }],
      ]),
    );
    expect(rows).toEqual([
      expect.objectContaining({ code: '110505', opening: 1000, debit: 500, credit: 200, closing: 1300 }),
      expect.objectContaining({ code: '413502', opening: 0, credit: 300, closing: -300, nature: 'credito' }),
    ]);
    expect(Ledger.totalByTypes(rows, ['ingreso'])).toBe(300);
  });

  it('aggregates by level keeping totals', () => {
    const rows = Ledger.rows(
      accounts,
      new Map(),
      new Map([
        [1, { debit: 100, credit: 0 }],
        [2, { debit: 50, credit: 0 }],
      ]),
      2,
    );
    expect(rows).toEqual([expect.objectContaining({ code: '11', debit: 150 })]);
  });
});

describe('posting rule keys', () => {
  it('validates keys and builds fallback chains', () => {
    expect(parsePostingRuleKey(' Payment.Debit.Method.Nequi ')).toBe('payment.debit.method.nequi');
    expect(() => parsePostingRuleKey('payment.foo')).toThrow(
      expect.objectContaining({ code: 'INVALID_POSTING_RULE_KEY' }),
    );
    expect(PostingRuleKeys.paymentDebit('Transferencia Ext')).toEqual([
      'payment.debit.method.transferencia_ext',
      'payment.debit.default',
    ]);
    expect(PostingRuleKeys.expenseDebit(null)).toEqual(['expense.debit.default']);
  });
});

describe('STANDARD_PUC', () => {
  it('is a valid hierarchy (bug 14: 24080501 hangs from 2408)', () => {
    const byCode = new Map<string, Account>();
    for (const seed of STANDARD_PUC) {
      const account = Account.create({
        ...seed,
        parent: seed.parentCode ? (byCode.get(seed.parentCode) ?? null) : null,
      });
      account.assignId(byCode.size + 1);
      byCode.set(seed.code, account);
    }
    expect(byCode.get('24080501')?.parentId).toBe(byCode.get('2408')?.id);
    expect(STANDARD_PUC).toHaveLength(68);
  });
});
