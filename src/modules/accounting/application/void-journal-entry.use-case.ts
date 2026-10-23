import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { toJournalEntryView, type JournalEntryView } from './journal-entry-view.js';

export interface VoidJournalEntryInput {
  id: number;
  reason: string;
  actor: AuthenticatedActor;
}

/**
 * Voids a posted entry (RN-JE-07). Its period must be open; the lines are kept
 * and reports exclude the entry. Fixes bug 9: status is checked server side and
 * the reason, user and date are stored. To cancel an entry of a closed period
 * use {@link ReverseJournalEntryUseCase}.
 */
@Injectable()
export class VoidJournalEntryUseCase implements UseCase<VoidJournalEntryInput, JournalEntryView> {
  constructor(
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    @Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ id, reason, actor }: VoidJournalEntryInput): Promise<JournalEntryView> {
    const entry = await this.entries.findById(id);
    if (!entry) throw new NotFoundError('Asiento contable', id);
    const period = await this.periods.findById(entry.periodId);
    if (!period) throw new NotFoundError('Periodo contable', entry.periodId);
    period.assertOpen();
    entry.void(actor.userId, this.clock.now(), reason);
    await this.entries.save(entry);
    return toJournalEntryView(entry);
  }
}
