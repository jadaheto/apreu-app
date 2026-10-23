import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { JournalEntry, JournalEntryStatus } from './journal-entry.js';
import type { VoucherType } from './voucher-type.js';

export interface JournalEntrySearchCriteria {
  from?: string;
  to?: string;
  type?: VoucherType;
  status?: JournalEntryStatus;
  /** `desc` (default): newest first; `asc`: chronological (general journal). */
  order?: 'asc' | 'desc';
}

/** Output port for persisting {@link JournalEntry} aggregates (header + lines). */
export interface JournalEntryRepository {
  findById(id: number): Promise<JournalEntry | null>;
  findBySource(sourceType: string, sourceId: string): Promise<JournalEntry | null>;
  /** Posted counter-entry of the given entry, if any. */
  findReversalOf(entryId: number): Promise<JournalEntry | null>;
  search(criteria: JournalEntrySearchCriteria, page: PageRequest): Promise<Paginated<JournalEntry>>;
  countDraftsInPeriod(periodId: number): Promise<number>;
  /** Inserts or updates the header and replaces its lines; assigns the id to new entries. */
  save(entry: JournalEntry): Promise<void>;
  /** Removes a draft with its lines. */
  delete(id: number): Promise<void>;
}

export const JOURNAL_ENTRY_REPOSITORY = Symbol('JournalEntryRepository');
