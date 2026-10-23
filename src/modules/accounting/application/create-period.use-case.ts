import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError } from '../../../shared/domain/domain-error.js';
import { AccountingPeriod } from '../domain/accounting-period.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { toPeriodView, type PeriodView } from './period-view.js';

export interface CreatePeriodInput {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Opens a new accounting period (RN-PER-01/02). Fixes bug 10: the range must
 * be ordered and must not overlap an existing period.
 */
@Injectable()
export class CreatePeriodUseCase implements UseCase<CreatePeriodInput, PeriodView> {
  constructor(@Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository) {}

  async execute(input: CreatePeriodInput): Promise<PeriodView> {
    const period = AccountingPeriod.create(input);
    const overlapping = await this.periods.findOverlapping(period.startDate, period.endDate);
    if (overlapping.length > 0) {
      throw new ConflictError(`El rango se cruza con el periodo "${overlapping[0].name}".`, {
        periodId: overlapping[0].id,
      });
    }
    await this.periods.save(period);
    return toPeriodView(period);
  }
}
