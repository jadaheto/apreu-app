import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { Role } from '../../../shared/domain/role.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { AutomaticEntryPoster } from '../application/automatic-entry-poster.js';
import { JournalEntryBooker } from '../application/journal-entry-booker.js';
import { JournalEntryLookups } from '../application/journal-entry-lookups.js';
import { LedgerReader } from '../application/ledger-reader.js';
import { Account } from '../domain/account.js';
import { AccountingPeriod } from '../domain/accounting-period.js';
import { STANDARD_PUC } from '../domain/standard-puc.js';
import {
  InMemoryAccountingPeriodRepository,
  InMemoryAccountRepository,
  InMemoryJournalEntryRepository,
  InMemoryLedgerQuery,
  InMemoryPostingRuleRepository,
  InMemoryThirdPartyRepository,
  InMemoryVoucherSequence,
  RecordingPostingLog,
} from './in-memory-accounting.js';

export const ACCOUNTANT: AuthenticatedActor = {
  userId: 7,
  role: Role.FINANCE,
  email: 'c@colegio.co',
  name: 'Contadora',
  tenant: 'demo',
};

/** Wires the accounting application services over in-memory adapters. */
export const createAccountingFixture = () => {
  const entries = new InMemoryJournalEntryRepository();
  const accounts = new InMemoryAccountRepository(entries);
  const thirdParties = new InMemoryThirdPartyRepository(entries);
  const periods = new InMemoryAccountingPeriodRepository();
  const rules = new InMemoryPostingRuleRepository();
  const sequence = new InMemoryVoucherSequence();
  const ledger = new InMemoryLedgerQuery(entries, thirdParties);
  const log = new RecordingPostingLog();
  // 2026-03-15 10:00 in Colombia.
  const clock = new FixedClock();
  const uow = new FakeUnitOfWork();
  const booker = new JournalEntryBooker(periods, accounts, thirdParties, entries, sequence);
  const lookups = new JournalEntryLookups(accounts, thirdParties);
  const reader = new LedgerReader(ledger, accounts);
  const events = new RecordingEventBus();
  const poster = new AutomaticEntryPoster(booker, entries, rules, uow, clock, log, events);

  /** Loads the standard PUC and returns a `code → Account` accessor. */
  const seedPuc = async () => {
    const byCode = new Map<string, Account>();
    for (const seed of STANDARD_PUC) {
      const account = Account.create({
        ...seed,
        parent: seed.parentCode ? (byCode.get(seed.parentCode) ?? null) : null,
      });
      await accounts.save(account);
      byCode.set(seed.code, account);
    }
    return (code: string) => byCode.get(code)?.id as number;
  };

  const openPeriod = async (name = 'Marzo 2026', startDate = '2026-03-01', endDate = '2026-03-31') => {
    const period = AccountingPeriod.create({ name, startDate, endDate });
    await periods.save(period);
    return period;
  };

  return {
    entries,
    accounts,
    thirdParties,
    periods,
    rules,
    sequence,
    ledger,
    log,
    events,
    clock,
    uow,
    booker,
    lookups,
    reader,
    poster,
    seedPuc,
    openPeriod,
  };
};

export type AccountingFixture = ReturnType<typeof createAccountingFixture>;
