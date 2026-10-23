import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { PageRequest } from '../../../shared/domain/pagination.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import type { VoucherType } from '../domain/voucher-type.js';
import { JournalEntryLookups } from './journal-entry-lookups.js';
import { toJournalEntryView } from './journal-entry-view.js';
import { parseRange, toAmount } from './ledger-reader.js';
import { LEDGER_QUERY, type LedgerQueryPort } from './ports/ledger-query.port.js';
import type { GeneralJournalView } from './report-views.js';

export interface GetGeneralJournalInput {
  from: string;
  to: string;
  type?: VoucherType;
  page: PageRequest;
}

/**
 * General journal ("libro diario", missing in the legacy): posted entries in
 * chronological order with their lines, plus range totals (ΣD = ΣC).
 */
@Injectable()
export class GetGeneralJournalUseCase implements UseCase<GetGeneralJournalInput, GeneralJournalView> {
  constructor(
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    @Inject(LEDGER_QUERY) private readonly ledger: LedgerQueryPort,
    private readonly lookups: JournalEntryLookups,
  ) {}

  async execute(input: GetGeneralJournalInput): Promise<GeneralJournalView> {
    const { from, to } = parseRange(input.from, input.to);
    const [page, movements] = await Promise.all([
      this.entries.search({ from, to, type: input.type, status: 'posted', order: 'asc' }, input.page),
      this.ledger.movementsByAccount({ from, to, entryType: input.type }),
    ]);
    const lookups = await this.lookups.for(page.items);
    const totals = movements.reduce(
      (acc, row) => ({ debit: acc.debit + row.debit.cents, credit: acc.credit + row.credit.cents }),
      { debit: 0, credit: 0 },
    );
    return {
      from,
      to,
      entries: { ...page, items: page.items.map((entry) => toJournalEntryView(entry, lookups)) },
      totals: { debit: toAmount(totals.debit), credit: toAmount(totals.credit) },
    };
  }
}
