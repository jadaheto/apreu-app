import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  ACCESS_LOG_QUERY,
  type AccessLogCriteria,
  type AccessLogQueryPort,
  type AccessLogRecord,
} from './ports/access-log-query.port.js';

export interface ListAccessLogInput {
  criteria: AccessLogCriteria;
  page: PageRequest;
}

/** Access audit trail for administrators, newest first (new; legacy only exposed it raw through API v1). */
@Injectable()
export class ListAccessLogUseCase implements UseCase<ListAccessLogInput, Paginated<AccessLogRecord>> {
  constructor(@Inject(ACCESS_LOG_QUERY) private readonly accessLog: AccessLogQueryPort) {}

  async execute({ criteria, page }: ListAccessLogInput): Promise<Paginated<AccessLogRecord>> {
    if (criteria.from && criteria.to && criteria.from > criteria.to) {
      throw new BusinessRuleViolationError('La fecha inicial no puede ser posterior a la final.', 'INVERTED_DATES');
    }
    return this.accessLog.search(criteria, page);
  }
}
