import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { JournalEntry } from '../domain/journal-entry.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import type { VoucherType } from '../domain/voucher-type.js';
import { JournalEntryBooker } from './journal-entry-booker.js';
import { JournalEntryLookups } from './journal-entry-lookups.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

export interface ReverseJournalEntryInput {
  id: number;
  reason: string;
  /** Date of the counter-entry; today (Colombia) by default. Must fall in an open period. */
  date?: string;
  /** Voucher type of the counter-entry; `NI` (nota interna) by default. */
  type?: VoucherType;
  actor: AuthenticatedActor;
}

/**
 * Reverses a posted entry with a counter-entry (same accounts, debit and
 * credit swapped) posted in the open period of the reversal date. Unlike
 * voiding, it works when the original period is already closed and leaves
 * the audit trail in the books. An entry can be reversed only once.
 */
@Injectable()
export class ReverseJournalEntryUseCase implements UseCase<ReverseJournalEntryInput, JournalEntryView> {
  constructor(
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    private readonly booker: JournalEntryBooker,
    private readonly lookups: JournalEntryLookups,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: ReverseJournalEntryInput): Promise<JournalEntryView> {
    const reason = input.reason?.trim();
    Guard.againstEmpty(reason, 'motivo de la reversión');
    const reversal = await this.uow.runInTransaction(async () => {
      const original = await this.entries.findById(input.id);
      if (!original) throw new NotFoundError('Asiento contable', input.id);
      if (await this.entries.findReversalOf(input.id)) {
        throw new ConflictError(`El asiento ${original.displayNumber} ya fue revertido.`);
      }
      const now = this.clock.now();
      const date = input.date ? CalendarDay.parse(input.date, 'fecha de la reversión') : CalendarDay.inColombia(now);
      const period = await this.booker.openPeriodFor(date);
      const counterEntry = JournalEntry.reversalOf(
        original,
        {
          periodId: period.id as number,
          date,
          type: input.type ?? 'NI',
          description: `Reversión de ${original.displayNumber}: ${reason}`.slice(0, 255),
        },
        input.actor.userId,
      );
      await this.booker.post(counterEntry, input.actor.userId, now);
      return counterEntry;
    });
    return toJournalEntryView(reversal, await this.lookups.for([reversal]));
  }
}
