import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { Calendar } from '../domain/calendar.js';
import {
  CHARGE_QUERIES,
  type ChargeListItem,
  type ChargeQueriesPort,
  type ChargeSearchCriteria,
} from './ports/charge-queries.port.js';

export interface ListChargesInput {
  criteria: Omit<ChargeSearchCriteria, 'today'>;
  page: PageRequest;
}

/** Paginated charges with filters by student, concept, status, period and overdue. */
@Injectable()
export class ListChargesUseCase implements UseCase<ListChargesInput, Paginated<ChargeListItem>> {
  constructor(
    @Inject(CHARGE_QUERIES) private readonly queries: ChargeQueriesPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ criteria, page }: ListChargesInput): Promise<Paginated<ChargeListItem>> {
    if (criteria.period) BillingPeriod.create(criteria.period);
    return this.queries.search({ ...criteria, today: Calendar.today(this.clock.now()) }, page);
  }
}
