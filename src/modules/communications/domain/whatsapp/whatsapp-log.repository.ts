import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { WhatsAppLog, WhatsAppStatus } from './whatsapp-log.js';

export interface WhatsAppLogCriteria {
  status?: WhatsAppStatus;
  /** Matches phone or template name. */
  search?: string;
}

/** A log entry plus the student's name (`students.first_name + last_name`). */
export interface WhatsAppLogRecord {
  log: WhatsAppLog;
  studentName: string | null;
}

/** Counters by status shown on the WhatsApp dashboard. */
export type WhatsAppKpis = Record<WhatsAppStatus, number>;

/** Output port for `whatsapp_log`. */
export interface WhatsAppLogRepository {
  save(log: WhatsAppLog): Promise<void>;
  findByMessageId(messageId: string): Promise<WhatsAppLog | null>;
  search(criteria: WhatsAppLogCriteria, page: PageRequest): Promise<Paginated<WhatsAppLogRecord>>;
  kpis(): Promise<WhatsAppKpis>;
}

export const WHATSAPP_LOG_REPOSITORY = Symbol('WhatsAppLogRepository');
