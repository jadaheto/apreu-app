/** Audit trail of authentication and page accesses (`access_log`). */
export interface AccessLogEntry {
  userId: number;
  role: string;
  path: string;
  module: string;
  allowed: boolean;
  ipAddress: string;
}

export interface AccessLogPort {
  record(entry: AccessLogEntry): Promise<void>;
}

export const ACCESS_LOG = Symbol('AccessLogPort');
