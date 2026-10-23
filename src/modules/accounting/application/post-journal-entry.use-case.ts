import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { JournalEntryBooker } from './journal-entry-booker.js';
import { JournalEntryLookups } from './journal-entry-lookups.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

export interface PostJournalEntryInput {
  id: number;
  actor: AuthenticatedActor;
}

/** Books a draft: validates double entry and references, assigns the consecutive. */
@Injectable()
export class PostJournalEntryUseCase implements UseCase<PostJournalEntryInput, JournalEntryView> {
  constructor(
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    private readonly booker: JournalEntryBooker,
    private readonly lookups: JournalEntryLookups,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ id, actor }: PostJournalEntryInput): Promise<JournalEntryView> {
    const entry = await this.uow.runInTransaction(async () => {
      const draft = await this.entries.findById(id);
      if (!draft) throw new NotFoundError('Asiento contable', id);
      await this.booker.post(draft, actor.userId, this.clock.now());
      return draft;
    });
    return toJournalEntryView(entry, await this.lookups.for([entry]));
  }
}
