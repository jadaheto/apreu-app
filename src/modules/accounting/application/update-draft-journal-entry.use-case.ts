import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { JournalEntryBooker } from './journal-entry-booker.js';
import { toJournalLines, type JournalEntryInput } from './journal-entry-input.js';
import { JournalEntryLookups } from './journal-entry-lookups.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

export interface UpdateDraftJournalEntryInput extends JournalEntryInput {
  id: number;
}

/** Replaces header and lines of a draft entry (posted entries are immutable, RN-JE-10). */
@Injectable()
export class UpdateDraftJournalEntryUseCase implements UseCase<UpdateDraftJournalEntryInput, JournalEntryView> {
  constructor(
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    private readonly booker: JournalEntryBooker,
    private readonly lookups: JournalEntryLookups,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute({ id, ...input }: UpdateDraftJournalEntryInput): Promise<JournalEntryView> {
    const entry = await this.uow.runInTransaction(async () => {
      const draft = await this.entries.findById(id);
      if (!draft) throw new NotFoundError('Asiento contable', id);
      const date = CalendarDay.parse(input.date, 'fecha del asiento');
      const periodId = input.periodId ?? ((await this.booker.openPeriodFor(date)).id as number);
      draft.updateDraft({
        periodId,
        date,
        type: input.type,
        description: input.description,
        lines: toJournalLines(input.lines),
      });
      await this.booker.saveDraft(draft);
      return draft;
    });
    return toJournalEntryView(entry, await this.lookups.for([entry]));
  }
}
