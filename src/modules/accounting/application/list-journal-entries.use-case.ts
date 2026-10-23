import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import type { JournalEntrySearchCriteria } from '../domain/journal-entry.repository.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

export interface ListJournalEntriesInput extends JournalEntrySearchCriteria {
  page: PageRequest;
}

/** Lists entry headers filtered by date range, type and status, paginated (legacy fixed limit of 150). */
@Injectable()
export class ListJournalEntriesUseCase implements UseCase<ListJournalEntriesInput, Paginated<JournalEntryView>> {
  constructor(@Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository) {}

  async execute({ page, ...criteria }: ListJournalEntriesInput): Promise<Paginated<JournalEntryView>> {
    return mapPage(await this.entries.search(criteria, page), (entry) => toJournalEntryView(entry));
  }
}
