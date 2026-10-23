import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import {
  EMAIL_LOG_REPOSITORY,
  type EmailLogCriteria,
  type EmailLogRepository,
} from '../../domain/email/email-log.repository.js';
import { type EmailLogView, toEmailLogView } from '../views.js';

export interface ListEmailLogsInput {
  criteria: EmailLogCriteria;
  page: PageRequest;
}

/** Paginated e-mail history, newest first (the legacy screen showed a fixed 30). */
@Injectable()
export class ListEmailLogsUseCase implements UseCase<ListEmailLogsInput, Paginated<EmailLogView>> {
  constructor(@Inject(EMAIL_LOG_REPOSITORY) private readonly logs: EmailLogRepository) {}

  async execute({ criteria, page }: ListEmailLogsInput): Promise<Paginated<EmailLogView>> {
    return mapPage(await this.logs.search(criteria, page), toEmailLogView);
  }
}
