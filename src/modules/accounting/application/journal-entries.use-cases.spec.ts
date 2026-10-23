import { ACCOUNTANT, createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { CreateJournalEntryUseCase } from './create-journal-entry.use-case.js';
import { DeleteDraftJournalEntryUseCase } from './delete-draft-journal-entry.use-case.js';
import { GetJournalEntryUseCase } from './get-journal-entry.use-case.js';
import { ListJournalEntriesUseCase } from './list-journal-entries.use-case.js';
import { PostJournalEntryUseCase } from './post-journal-entry.use-case.js';
import { ReverseJournalEntryUseCase } from './reverse-journal-entry.use-case.js';
import { UpdateDraftJournalEntryUseCase } from './update-draft-journal-entry.use-case.js';
import { VoidJournalEntryUseCase } from './void-journal-entry.use-case.js';

describe('journal entry use cases', () => {
  let f: AccountingFixture;
  let id: (code: string) => number;
  let create: CreateJournalEntryUseCase;

  const input = (overrides: Record<string, unknown> = {}) => ({
    date: '2026-03-10',
    type: 'RC' as const,
    description: 'Pensión marzo',
    lines: [
      { accountId: id('110505'), debit: 350000 },
      { accountId: id('413502'), credit: 350000, description: 'Pensión' },
    ],
    actor: ACCOUNTANT,
    ...overrides,
  });

  beforeEach(async () => {
    f = createAccountingFixture();
    id = await f.seedPuc();
    await f.openPeriod();
    create = new CreateJournalEntryUseCase(f.booker, f.lookups, f.uow, f.clock);
  });

  describe('CreateJournalEntryUseCase', () => {
    it('posts with a consecutive per type, inferring the period, in a transaction', async () => {
      const first = await create.execute(input());
      const second = await create.execute(input());
      const other = await create.execute(input({ type: 'CE' }));
      expect([first.displayNumber, second.displayNumber, other.displayNumber]).toEqual([
        'RC-000001',
        'RC-000002',
        'CE-000001',
      ]);
      expect(first).toMatchObject({ status: 'posted', totalDebit: 350000, createdBy: 7, postedBy: 7 });
      expect(first.lines?.[1]).toMatchObject({ accountCode: '413502', accountName: 'Pensiones', credit: 350000 });
      expect(f.uow.transactions).toBe(3);
    });

    it('can keep the entry as an unnumbered draft', async () => {
      const draft = await create.execute(input({ postImmediately: false }));
      expect(draft).toMatchObject({ status: 'draft', number: null, displayNumber: null });
    });

    it.each([
      ['lines without account', { lines: [{ accountId: 0, debit: 1 }] }, 'LINE_ACCOUNT_REQUIRED'],
      ['lines with both sides', { lines: [{ accountId: 1, debit: 1, credit: 1 }] }, 'INVALID_LINE_AMOUNT'],
      ['dates without open period', { date: '2026-05-01' }, 'NO_OPEN_PERIOD'],
    ])('rejects %s', async (_label, overrides, code) => {
      await expect(create.execute(input(overrides))).rejects.toMatchObject({ code });
    });

    it('rejects unbalanced entries and summary accounts (bug 7)', async () => {
      await expect(
        create.execute(
          input({
            lines: [
              { accountId: id('110505'), debit: 100 },
              { accountId: id('413502'), credit: 90 },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: 'ENTRY_NOT_BALANCED' });
      await expect(
        create.execute(
          input({
            lines: [
              { accountId: id('1105'), debit: 100 },
              { accountId: id('413502'), credit: 100 },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_TRANSACTIONAL' });
      expect(f.entries.store.all()).toHaveLength(0);
    });

    it('rejects dates outside the chosen period (bug 8)', async () => {
      const april = await f.openPeriod('Abril', '2026-04-01', '2026-04-30');
      await expect(create.execute(input({ periodId: april.id }))).rejects.toMatchObject({
        code: 'DATE_OUTSIDE_PERIOD',
      });
    });
  });

  describe('draft lifecycle', () => {
    it('updates, posts and deletes drafts', async () => {
      const draft = await create.execute(input({ postImmediately: false }));
      const update = new UpdateDraftJournalEntryUseCase(f.entries, f.booker, f.lookups, f.uow);
      await expect(update.execute({ id: draft.id, ...input({ description: 'Corregido' }) })).resolves.toMatchObject({
        description: 'Corregido',
      });
      await expect(update.execute({ id: 99, ...input() })).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const post = new PostJournalEntryUseCase(f.entries, f.booker, f.lookups, f.uow, f.clock);
      await expect(post.execute({ id: draft.id, actor: ACCOUNTANT })).resolves.toMatchObject({
        displayNumber: 'RC-000001',
      });
      await expect(post.execute({ id: 99, actor: ACCOUNTANT })).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const remove = new DeleteDraftJournalEntryUseCase(f.entries);
      await expect(remove.execute(draft.id)).rejects.toMatchObject({ code: 'ENTRY_NOT_DRAFT' });
      const other = await create.execute(input({ postImmediately: false }));
      await remove.execute(other.id);
      expect(await f.entries.findById(other.id)).toBeNull();
      await expect(remove.execute(other.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('queries', () => {
    it('lists headers and returns the detail', async () => {
      const posted = await create.execute(input());
      await create.execute(input({ type: 'CE' }));
      const list = await new ListJournalEntriesUseCase(f.entries).execute({ type: 'RC', page: { page: 1, limit: 10 } });
      expect(list.items.map((e) => e.id)).toEqual([posted.id]);
      expect(list.items[0].lines).toBeUndefined();
      const detail = await new GetJournalEntryUseCase(f.entries, f.lookups).execute(posted.id);
      expect(detail.lines).toHaveLength(2);
      await expect(new GetJournalEntryUseCase(f.entries, f.lookups).execute(99)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('VoidJournalEntryUseCase', () => {
    it('voids posted entries of open periods with audit data (bug 9)', async () => {
      const posted = await create.execute(input());
      const voidEntry = new VoidJournalEntryUseCase(f.entries, f.periods, f.clock);
      await expect(voidEntry.execute({ id: posted.id, reason: 'Duplicado', actor: ACCOUNTANT })).resolves.toMatchObject(
        {
          status: 'voided',
          voidReason: 'Duplicado',
          voidedBy: 7,
        },
      );
      await expect(voidEntry.execute({ id: posted.id, reason: 'otra', actor: ACCOUNTANT })).rejects.toMatchObject({
        code: 'ENTRY_NOT_POSTED',
      });
      await expect(voidEntry.execute({ id: 99, reason: 'x', actor: ACCOUNTANT })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('refuses to void entries of closed periods', async () => {
      const posted = await create.execute(input());
      (await f.periods.findById(posted.periodId))?.close(1, f.clock.now());
      await expect(
        new VoidJournalEntryUseCase(f.entries, f.periods, f.clock).execute({
          id: posted.id,
          reason: 'x',
          actor: ACCOUNTANT,
        }),
      ).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
    });
  });

  describe('ReverseJournalEntryUseCase', () => {
    it('posts a counter-entry once, even when the original period is closed', async () => {
      await f.openPeriod('Febrero', '2026-02-01', '2026-02-28');
      const posted = await create.execute(input({ date: '2026-02-10' }));
      (await f.periods.findById(posted.periodId))?.close(1, f.clock.now());
      const reverse = new ReverseJournalEntryUseCase(f.entries, f.booker, f.lookups, f.uow, f.clock);
      const reversal = await reverse.execute({ id: posted.id, reason: 'Error', actor: ACCOUNTANT });
      expect(reversal).toMatchObject({ date: '2026-03-15', displayNumber: 'NI-000001', reversalOfId: posted.id });
      expect(reversal.lines?.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([
        ['110505', 0, 350000],
        ['413502', 350000, 0],
      ]);
      await expect(reverse.execute({ id: posted.id, reason: 'Otra', actor: ACCOUNTANT })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      await expect(reverse.execute({ id: 99, reason: 'x', actor: ACCOUNTANT })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(reverse.execute({ id: posted.id, reason: ' ', actor: ACCOUNTANT })).rejects.toMatchObject({
        code: 'REQUIRED_FIELD',
      });
    });
  });
});
