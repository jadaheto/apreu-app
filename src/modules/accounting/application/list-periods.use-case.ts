import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { toPeriodView, type PeriodView } from './period-view.js';

/** Lists accounting periods, newest first (legacy `periods.php`). */
@Injectable()
export class ListPeriodsUseCase implements UseCase<void, PeriodView[]> {
  constructor(@Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository) {}

  async execute(): Promise<PeriodView[]> {
    return (await this.periods.findAll()).map(toPeriodView);
  }
}
