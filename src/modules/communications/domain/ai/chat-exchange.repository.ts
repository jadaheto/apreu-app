import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { ChatExchange } from './chat-exchange.js';

export interface ChatLogCriteria {
  userId?: number;
  role?: string;
  /** Inclusive `YYYY-MM-DD` range over the creation day. */
  from?: string;
  to?: string;
  /** Matches the question or the user's name. */
  search?: string;
}

/** Exchange plus author data for the global monitor. */
export interface ChatLogRecord {
  exchange: ChatExchange;
  userName: string | null;
  userEmail: string | null;
}

/** Output port for `ai_chat_logs`. */
export interface ChatExchangeRepository {
  save(exchange: ChatExchange): Promise<void>;
  /** Newest first. */
  search(criteria: ChatLogCriteria, page: PageRequest): Promise<Paginated<ChatLogRecord>>;
}

export const CHAT_EXCHANGE_REPOSITORY = Symbol('ChatExchangeRepository');
