import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { assertDay } from '../../domain/common/format.js';
import {
  CHAT_EXCHANGE_REPOSITORY,
  type ChatExchangeRepository,
  type ChatLogCriteria,
} from '../../domain/ai/chat-exchange.repository.js';
import { type ChatExchangeView, type ChatLogView, toChatExchangeView, toChatLogView } from '../views.js';

/**
 * The signed-in user's own conversations (legacy `student/ai_history.php` and
 * `employee/ai_history.php`, RN-COM-17). Filtering only by user fixes the
 * inconsistent count of bug #19.
 */
@Injectable()
export class ListMyChatHistoryUseCase implements UseCase<
  { userId: number; page: PageRequest },
  Paginated<ChatExchangeView>
> {
  constructor(@Inject(CHAT_EXCHANGE_REPOSITORY) private readonly exchanges: ChatExchangeRepository) {}

  async execute({ userId, page }: { userId: number; page: PageRequest }): Promise<Paginated<ChatExchangeView>> {
    return mapPage(await this.exchanges.search({ userId }, page), ({ exchange }) => toChatExchangeView(exchange));
  }
}

/** Global AI monitor of the school with filters by role, dates and text (legacy `admin/ai_logs.php`). */
@Injectable()
export class ListChatLogsUseCase implements UseCase<
  { criteria: ChatLogCriteria; page: PageRequest },
  Paginated<ChatLogView>
> {
  constructor(@Inject(CHAT_EXCHANGE_REPOSITORY) private readonly exchanges: ChatExchangeRepository) {}

  async execute({ criteria, page }: { criteria: ChatLogCriteria; page: PageRequest }): Promise<Paginated<ChatLogView>> {
    if (criteria.from) assertDay(criteria.from, 'desde');
    if (criteria.to) assertDay(criteria.to, 'hasta');
    if (criteria.from && criteria.to) {
      Guard.againstInvertedDates(new Date(criteria.from), new Date(criteria.to), 'rango de fechas');
    }
    return mapPage(await this.exchanges.search(criteria, page), toChatLogView);
  }
}
