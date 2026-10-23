import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { toPeriodView, type PeriodView } from './period-view.js';

export interface ClosePeriodInput {
  periodId: number;
  actor: AuthenticatedActor;
}

/**
 * Closes a period. Explicit transition (bug 10: the legacy toggle trusted the
 * status sent by the browser). A period with draft entries cannot be closed
 * because those drafts could never be posted.
 */
@Injectable()
export class ClosePeriodUseCase implements UseCase<ClosePeriodInput, PeriodView> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository,
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ periodId, actor }: ClosePeriodInput): Promise<PeriodView> {
    const period = await this.periods.findById(periodId);
    if (!period) throw new NotFoundError('Periodo contable', periodId);
    const drafts = await this.entries.countDraftsInPeriod(periodId);
    if (drafts > 0) {
      throw new BusinessRuleViolationError(
        `El periodo tiene ${drafts} asiento(s) en borrador. Contabilícelos o elimínelos antes de cerrar.`,
        'PERIOD_HAS_DRAFTS',
      );
    }
    period.close(actor.userId, this.clock.now());
    await this.periods.save(period);
    return toPeriodView(period);
  }
}
