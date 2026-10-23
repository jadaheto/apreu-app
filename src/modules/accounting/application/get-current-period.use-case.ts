import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { CalendarDay } from '../domain/calendar-day.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { findCurrentPeriod } from './current-period.js';
import { toPeriodView, type PeriodView } from './period-view.js';

/** Period containing today's date in Colombia, or `null`. */
@Injectable()
export class GetCurrentPeriodUseCase implements UseCase<void, PeriodView | null> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<PeriodView | null> {
    const period = await findCurrentPeriod(this.periods, CalendarDay.inColombia(this.clock.now()));
    return period ? toPeriodView(period) : null;
  }
}
