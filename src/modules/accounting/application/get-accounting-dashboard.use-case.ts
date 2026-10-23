import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { Ledger } from '../domain/ledger.js';
import { findCurrentPeriod } from './current-period.js';
import { toJournalEntryView } from './journal-entry-view.js';
import { LedgerReader, toAmount } from './ledger-reader.js';
import { LEDGER_QUERY, type LedgerQueryPort } from './ports/ledger-query.port.js';
import { toPeriodView } from './period-view.js';
import type { AccountingDashboardView } from './report-views.js';

const LATEST_ENTRIES = 8;

/**
 * Accounting dashboard (legacy `accounting/index.php`): KPIs of the month over
 * posted entries, latest entries and current period. Fixes bug 4 (a failing
 * `FETCH_KEY_PAIR` zeroed every KPI) and bug 11 (non deterministic current
 * period). Net income also subtracts costs, consistent with the P&G.
 */
@Injectable()
export class GetAccountingDashboardUseCase implements UseCase<string | undefined, AccountingDashboardView> {
  constructor(
    private readonly reader: LedgerReader,
    @Inject(LEDGER_QUERY) private readonly ledger: LedgerQueryPort,
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    @Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(monthInput?: string): Promise<AccountingDashboardView> {
    const today = CalendarDay.inColombia(this.clock.now());
    const month = monthInput ?? today.slice(0, 7);
    const { from, to } = CalendarDay.monthRange(month);
    const [rows, entriesCount, latest, currentPeriod] = await Promise.all([
      this.reader.rows({ from, to, withOpening: false }),
      this.ledger.countPostedEntries({ from, to }),
      this.entries.search({ order: 'desc' }, { page: 1, limit: LATEST_ENTRIES }),
      findCurrentPeriod(this.periods, today),
    ]);
    const income = Ledger.totalByTypes(rows, ['ingreso']);
    const costs = Ledger.totalByTypes(rows, ['costo']);
    const expenses = Ledger.totalByTypes(rows, ['gasto']);
    return {
      month,
      from,
      to,
      income: toAmount(income),
      costs: toAmount(costs),
      expenses: toAmount(expenses),
      netIncome: toAmount(income - costs - expenses),
      entriesCount,
      latestEntries: latest.items.map((entry) => toJournalEntryView(entry)),
      currentPeriod: currentPeriod ? toPeriodView(currentPeriod) : null,
    };
  }
}
