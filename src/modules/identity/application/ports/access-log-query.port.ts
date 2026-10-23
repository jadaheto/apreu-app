import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';

/** Filters accepted by the access-log viewer. Dates are inclusive `YYYY-MM-DD` days. */
export interface AccessLogCriteria {
  userId?: number;
  module?: string;
  allowed?: boolean;
  from?: string;
  to?: string;
  /** Free text over the path and the user's name or e-mail. */
  search?: string;
}

/** A row of `access_log` joined with the user (if it still exists). */
export interface AccessLogRecord {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  role: string;
  path: string;
  module: string;
  allowed: boolean;
  ipAddress: string;
  createdAt: Date | null;
}

/** Read side of the access audit trail, newest first. */
export interface AccessLogQueryPort {
  search(criteria: AccessLogCriteria, page: PageRequest): Promise<Paginated<AccessLogRecord>>;
}

export const ACCESS_LOG_QUERY = Symbol('AccessLogQueryPort');
