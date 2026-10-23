import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { JournalEntryLookups } from './journal-entry-lookups.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

/** Entry header plus its lines with account and third party names. */
@Injectable()
export class GetJournalEntryUseCase implements UseCase<number, JournalEntryView> {
  constructor(
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    private readonly lookups: JournalEntryLookups,
  ) {}

  async execute(id: number): Promise<JournalEntryView> {
    const entry = await this.entries.findById(id);
    if (!entry) throw new NotFoundError('Asiento contable', id);
    return toJournalEntryView(entry, await this.lookups.for([entry]));
  }
}
