import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { toPeriodView, type PeriodView } from './period-view.js';

export interface ReopenPeriodInput {
  periodId: number;
  reason: string;
  actor: AuthenticatedActor;
}

/**
 * Reopens a closed period (RN-PER-04). Restricted to admin/superadmin at the
 * HTTP layer; the reason, user and date are stored for auditing.
 */
@Injectable()
export class ReopenPeriodUseCase implements UseCase<ReopenPeriodInput, PeriodView> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ periodId, reason, actor }: ReopenPeriodInput): Promise<PeriodView> {
    const period = await this.periods.findById(periodId);
    if (!period) throw new NotFoundError('Periodo contable', periodId);
    period.reopen(actor.userId, this.clock.now(), reason);
    await this.periods.save(period);
    return toPeriodView(period);
  }
}
