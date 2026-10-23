import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { JournalEntry } from '../domain/journal-entry.js';
import { JournalLine } from '../domain/journal-line.js';
import { ACCOUNTANT, createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { ClosePeriodUseCase } from './close-period.use-case.js';
import { CreatePeriodUseCase } from './create-period.use-case.js';
import { GetCurrentPeriodUseCase } from './get-current-period.use-case.js';
import { ListPeriodsUseCase } from './list-periods.use-case.js';
import { ReopenPeriodUseCase } from './reopen-period.use-case.js';

describe('period use cases', () => {
  let f: AccountingFixture;

  beforeEach(() => {
    f = createAccountingFixture();
  });

  it('creates periods without overlaps and lists them newest first', async () => {
    const create = new CreatePeriodUseCase(f.periods);
    await create.execute({ name: 'Febrero', startDate: '2026-02-01', endDate: '2026-02-28' });
    await create.execute({ name: 'Marzo', startDate: '2026-03-01', endDate: '2026-03-31' });
    await expect(
      create.execute({ name: 'Cruce', startDate: '2026-03-15', endDate: '2026-04-15' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const list = await new ListPeriodsUseCase(f.periods).execute();
    expect(list.map((p) => p.name)).toEqual(['Marzo', 'Febrero']);
  });

  it('returns the current period preferring open ones', async () => {
    const current = new GetCurrentPeriodUseCase(f.periods, f.clock);
    await expect(current.execute()).resolves.toBeNull();
    const march = await f.openPeriod();
    await expect(current.execute()).resolves.toMatchObject({ id: march.id, status: 'open' });
  });

  it('closes a period unless it has drafts, and reopens it with a reason', async () => {
    const period = await f.openPeriod();
    const close = new ClosePeriodUseCase(f.periods, f.entries, f.clock);
    const draft = JournalEntry.draft(
      {
        periodId: period.id as number,
        date: '2026-03-02',
        type: 'NI',
        description: 'Borrador',
        lines: [JournalLine.create({ accountId: 1, debit: Money.of(1) })],
      },
      1,
    );
    await f.entries.save(draft);
    await expect(close.execute({ periodId: period.id as number, actor: ACCOUNTANT })).rejects.toMatchObject({
      code: 'PERIOD_HAS_DRAFTS',
    });
    f.entries.store.items.clear();

    await expect(close.execute({ periodId: period.id as number, actor: ACCOUNTANT })).resolves.toMatchObject({
      status: 'closed',
      closedBy: ACCOUNTANT.userId,
    });
    const reopen = new ReopenPeriodUseCase(f.periods, f.clock);
    await expect(
      reopen.execute({ periodId: period.id as number, reason: 'Ajuste', actor: ACCOUNTANT }),
    ).resolves.toMatchObject({ status: 'open', reopenReason: 'Ajuste' });
    await expect(close.execute({ periodId: 99, actor: ACCOUNTANT })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(reopen.execute({ periodId: 99, reason: 'x', actor: ACCOUNTANT })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
