import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { JournalEntry } from '../domain/journal-entry.js';
import { JournalEntryBooker } from './journal-entry-booker.js';
import { toJournalLines, type JournalEntryInput } from './journal-entry-input.js';
import { JournalEntryLookups } from './journal-entry-lookups.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

export interface CreateJournalEntryInput extends JournalEntryInput {
  /** `true` (default, legacy behaviour): post right away; `false`: keep as draft. */
  postImmediately?: boolean;
  actor: AuthenticatedActor;
}

/**
 * Creates a manual journal entry (legacy `entries.php` `action=create`).
 *
 * Fixes bugs 5–8: header, lines and consecutive are stored in one
 * transaction; the consecutive is locked per voucher type; lines are
 * validated (non-negative, one side, transactional accounts, ≥ 2 lines,
 * ΣD = ΣC > 0); the date must belong to the open period.
 */
@Injectable()
export class CreateJournalEntryUseCase implements UseCase<CreateJournalEntryInput, JournalEntryView> {
  constructor(
    private readonly booker: JournalEntryBooker,
    private readonly lookups: JournalEntryLookups,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: CreateJournalEntryInput): Promise<JournalEntryView> {
    const entry = await this.uow.runInTransaction(async () => {
      const date = CalendarDay.parse(input.date, 'fecha del asiento');
      const periodId = input.periodId ?? ((await this.booker.openPeriodFor(date)).id as number);
      const draft = JournalEntry.draft(
        { periodId, date, type: input.type, description: input.description, lines: toJournalLines(input.lines) },
        input.actor.userId,
      );
      if (input.postImmediately === false) await this.booker.saveDraft(draft);
      else await this.booker.post(draft, input.actor.userId, this.clock.now());
      return draft;
    });
    return toJournalEntryView(entry, await this.lookups.for([entry]));
  }
}
