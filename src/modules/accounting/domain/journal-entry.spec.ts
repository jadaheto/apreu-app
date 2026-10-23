import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { Account } from './account.js';
import { AccountingPeriod } from './accounting-period.js';
import { JournalEntryPolicy } from './journal-entry-policy.js';
import { JournalEntry } from './journal-entry.js';
import { JournalLine } from './journal-line.js';
import { ThirdParty } from './third-party.js';

const line = (accountId: number, debit: number, credit: number, thirdPartyId: number | null = null) =>
  JournalLine.create({ accountId, thirdPartyId, debit: Money.of(debit), credit: Money.of(credit) });

const content = (lines = [line(1, 100, 0), line(2, 0, 100)]) => ({
  periodId: 1,
  date: '2026-03-10',
  type: 'RC' as const,
  description: 'Pago pensión',
  lines,
});

const at = new Date('2026-03-10T15:00:00Z');

describe('JournalLine', () => {
  it.each([
    [100, 100, 'INVALID_LINE_AMOUNT'],
    [0, 0, 'INVALID_LINE_AMOUNT'],
    [-5, 0, 'NEGATIVE_LINE_AMOUNT'],
  ])('rejects debit=%s credit=%s', (debit, credit, code) => {
    expect(() => line(1, debit, credit)).toThrow(expect.objectContaining({ code }));
  });

  it('swaps sides for reversals', () => {
    const swapped = line(1, 100, 0).swapped();
    expect([swapped.debit.amount, swapped.credit.amount]).toEqual([0, 100]);
  });
});

describe('JournalEntry', () => {
  it('posts a balanced entry with the consecutive', () => {
    const entry = JournalEntry.draft(content(), 7);
    entry.post('000001', 7, at);
    expect(entry).toMatchObject({ status: 'posted', number: '000001', displayNumber: 'RC-000001', postedBy: 7 });
    expect(entry.totalDebit.amount).toBe(100);
  });

  it('rejects unbalanced entries and single lines when posting', () => {
    const unbalanced = JournalEntry.draft(content([line(1, 100, 0), line(2, 0, 90)]), 7);
    expect(() => unbalanced.post('1', 7, at)).toThrow(expect.objectContaining({ code: 'ENTRY_NOT_BALANCED' }));
    const single = JournalEntry.draft(content([line(1, 100, 0)]), 7);
    expect(() => single.post('1', 7, at)).toThrow(expect.objectContaining({ code: 'ENTRY_TOO_FEW_LINES' }));
  });

  it('validates the header', () => {
    expect(() => JournalEntry.draft({ ...content(), description: ' ' }, 7)).toThrow(
      expect.objectContaining({ code: 'REQUIRED_FIELD' }),
    );
    expect(() => JournalEntry.draft({ ...content(), type: 'XX' as never }, 7)).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
    expect(() => JournalEntry.draft({ ...content(), lines: [] }, 7)).toThrow(
      expect.objectContaining({ code: 'ENTRY_WITHOUT_LINES' }),
    );
  });

  it('only edits drafts and only voids posted entries', () => {
    const entry = JournalEntry.draft(content(), 7);
    expect(() => entry.void(7, at, 'x')).toThrow(expect.objectContaining({ code: 'ENTRY_NOT_POSTED' }));
    entry.updateDraft({ ...content(), description: 'Editado' });
    entry.post('000002', 7, at);
    expect(() => entry.updateDraft(content())).toThrow(expect.objectContaining({ code: 'ENTRY_NOT_DRAFT' }));
    expect(() => entry.post('000003', 7, at)).toThrow(expect.objectContaining({ code: 'ENTRY_NOT_DRAFT' }));
    expect(() => entry.void(7, at, '')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    entry.void(9, at, 'Error de digitación');
    expect(entry).toMatchObject({ status: 'voided', voidedBy: 9, voidReason: 'Error de digitación' });
    expect(() => entry.void(9, at, 'otra vez')).toThrow(expect.objectContaining({ code: 'ENTRY_NOT_POSTED' }));
  });

  it('builds a reversal with swapped lines', () => {
    const original = JournalEntry.draft(content(), 7);
    expect(() => JournalEntry.reversalOf(original, { ...content(), type: 'NI' }, 7)).toThrow(
      expect.objectContaining({ code: 'ENTRY_NOT_POSTED' }),
    );
    original.post('000001', 7, at);
    original.assignId(5);
    const reversal = JournalEntry.reversalOf(
      original,
      { periodId: 1, date: '2026-03-20', type: 'NI', description: 'Rev' },
      7,
    );
    expect(reversal.reversalOfId).toBe(5);
    expect(reversal.lines.map((l) => [l.accountId, l.debit.amount, l.credit.amount])).toEqual([
      [1, 0, 100],
      [2, 100, 0],
    ]);
  });
});

describe('JournalEntryPolicy', () => {
  const movement = (id: number, code: string, isTransactional = true) => {
    const account = Account.create({ code, name: code, isTransactional, parent: null });
    account.assignId(id);
    return account;
  };
  const period = () => {
    const p = AccountingPeriod.create({ name: 'Marzo', startDate: '2026-03-01', endDate: '2026-03-31' });
    p.assignId(1);
    return p;
  };
  const accounts = new Map([
    [1, movement(1, '110505')],
    [2, movement(2, '413502')],
    [3, movement(3, '1105', false)],
  ]);
  const party = ThirdParty.create({ documentType: 'CC', documentNumber: '1', name: 'Ana' });
  party.assignId(4);
  const context = (overrides = {}) => ({
    period: period(),
    accounts,
    thirdParties: new Map([[4, party]]),
    ...overrides,
  });

  it('accepts a valid entry', () => {
    expect(() => JournalEntryPolicy.assertBookable(JournalEntry.draft(content(), 7), context())).not.toThrow();
  });

  it('requires an open period that contains the date', () => {
    const closed = period();
    closed.close(1, at);
    expect(() =>
      JournalEntryPolicy.assertBookable(JournalEntry.draft(content(), 7), context({ period: closed })),
    ).toThrow(expect.objectContaining({ code: 'PERIOD_CLOSED' }));
    expect(() =>
      JournalEntryPolicy.assertBookable(JournalEntry.draft(content(), 7), context({ period: null })),
    ).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    const outside = JournalEntry.draft({ ...content(), date: '2026-04-01' }, 7);
    expect(() => JournalEntryPolicy.assertBookable(outside, context())).toThrow(
      expect.objectContaining({ code: 'DATE_OUTSIDE_PERIOD' }),
    );
  });

  it('rejects summary accounts, unknown accounts and inactive third parties', () => {
    const summary = JournalEntry.draft(content([line(3, 100, 0), line(2, 0, 100)]), 7);
    expect(() => JournalEntryPolicy.assertBookable(summary, context())).toThrow(
      expect.objectContaining({ code: 'ACCOUNT_NOT_TRANSACTIONAL' }),
    );
    const unknown = JournalEntry.draft(content([line(99, 100, 0), line(2, 0, 100)]), 7);
    expect(() => JournalEntryPolicy.assertBookable(unknown, context())).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
    party.deactivate();
    const withParty = JournalEntry.draft(content([line(1, 100, 0, 4), line(2, 0, 100)]), 7);
    expect(() => JournalEntryPolicy.assertBookable(withParty, context())).toThrow(
      expect.objectContaining({ code: 'THIRD_PARTY_INACTIVE' }),
    );
    party.activate();
  });
});
