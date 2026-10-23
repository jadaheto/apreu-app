import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { EmailLog, EmailStatus, EmailType } from './email-log.js';

export interface EmailLogCriteria {
  type?: EmailType;
  status?: EmailStatus;
  /** Matches recipient e-mail/name or subject. */
  search?: string;
}

/** A log entry plus the name of the user who sent it (`users.name`). */
export interface EmailLogRecord {
  log: EmailLog;
  sentByName: string | null;
}

/** Totals shown on the e-mail dashboard (legacy `email/index.php`). */
export interface EmailKpis {
  total: number;
  notices: number;
  billing: number;
  dian: number;
  failed: number;
}

/** Output port for `email_log`. */
export interface EmailLogRepository {
  save(log: EmailLog): Promise<void>;
  search(criteria: EmailLogCriteria, page: PageRequest): Promise<Paginated<EmailLogRecord>>;
  kpis(): Promise<EmailKpis>;
}

export const EMAIL_LOG_REPOSITORY = Symbol('EmailLogRepository');
