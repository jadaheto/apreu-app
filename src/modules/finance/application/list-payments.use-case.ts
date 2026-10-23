import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import { Calendar } from '../domain/calendar.js';
import {
  PAYMENT_QUERIES,
  type PaymentListItem,
  type PaymentQueriesPort,
  type PaymentSearchCriteria,
} from './ports/payment-queries.port.js';

/** Paginated payments filtered by date range, student, status and method. */
@Injectable()
export class ListPaymentsUseCase implements UseCase<
  { criteria: PaymentSearchCriteria; page: PageRequest },
  Paginated<PaymentListItem>
> {
  constructor(@Inject(PAYMENT_QUERIES) private readonly queries: PaymentQueriesPort) {}

  async execute({
    criteria,
    page,
  }: {
    criteria: PaymentSearchCriteria;
    page: PageRequest;
  }): Promise<Paginated<PaymentListItem>> {
    if (criteria.from) Calendar.assertDate(criteria.from, 'desde');
    if (criteria.to) Calendar.assertDate(criteria.to, 'hasta');
    return this.queries.search(criteria, page);
  }
}
