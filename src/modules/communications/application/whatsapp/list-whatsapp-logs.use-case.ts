import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import {
  WHATSAPP_LOG_REPOSITORY,
  type WhatsAppLogCriteria,
  type WhatsAppLogRepository,
} from '../../domain/whatsapp/whatsapp-log.repository.js';
import { toWhatsAppLogView, type WhatsAppLogView } from '../views.js';

export interface ListWhatsAppLogsInput {
  criteria: WhatsAppLogCriteria;
  page: PageRequest;
}

/** Paginated WhatsApp history, newest first. */
@Injectable()
export class ListWhatsAppLogsUseCase implements UseCase<ListWhatsAppLogsInput, Paginated<WhatsAppLogView>> {
  constructor(@Inject(WHATSAPP_LOG_REPOSITORY) private readonly logs: WhatsAppLogRepository) {}

  async execute({ criteria, page }: ListWhatsAppLogsInput): Promise<Paginated<WhatsAppLogView>> {
    return mapPage(await this.logs.search(criteria, page), toWhatsAppLogView);
  }
}
