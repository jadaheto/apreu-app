import { Injectable } from '@nestjs/common';
import { likePattern, SqlParams, unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import type {
  AccessLogCriteria,
  AccessLogQueryPort,
  AccessLogRecord,
} from '../../application/ports/access-log-query.port.js';

interface AccessLogRow {
  id: string;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  role: string;
  path: string;
  module: string;
  allowed: boolean;
  ip_address: string;
  created_at: Date | null;
}

/** Parameterized read of `access_log` joined with `users`. */
@Injectable()
export class SqlAccessLogQuery implements AccessLogQueryPort {
  constructor(private readonly db: TenantDataSource) {}

  async search(criteria: AccessLogCriteria, page: PageRequest): Promise<Paginated<AccessLogRecord>> {
    const params = new SqlParams();
    const where = this.filters(criteria, params);
    const from = 'FROM access_log a LEFT JOIN users u ON u.id = a.user_id';
    const manager = await this.db.manager();
    const countParams = params.values;
    const limit = params.add(page.limit);
    const offset = params.add(toOffset(page));
    const [rows, countRows]: [AccessLogRow[], { total: number }[]] = await Promise.all([
      manager.query(
        `SELECT a.id, a.user_id, u.name AS user_name, u.email AS user_email, a.role, a.path, a.module, a.allowed,
                a.ip_address, a.created_at
         ${from} ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit} OFFSET ${offset}`,
        params.values,
      ),
      manager.query(`SELECT COUNT(*)::int AS total ${from} ${where}`, countParams),
    ]);
    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        userName: row.user_name,
        userEmail: row.user_email,
        role: row.role,
        path: row.path,
        module: row.module,
        allowed: row.allowed === true,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
      })),
      total: Number(countRows[0]?.total ?? 0),
      page: page.page,
      limit: page.limit,
    };
  }

  /** Day bounds are school-local dates (the tenant connection runs in America/Bogota). */
  private filters(criteria: AccessLogCriteria, params: SqlParams): string {
    const clauses: string[] = [];
    if (criteria.userId !== undefined) clauses.push(`a.user_id = ${params.add(criteria.userId)}`);
    if (criteria.module) clauses.push(`a.module = ${params.add(criteria.module)}`);
    if (criteria.allowed !== undefined) clauses.push(`a.allowed = ${params.add(criteria.allowed)}`);
    if (criteria.from) clauses.push(`a.created_at >= ${params.add(criteria.from)}::date`);
    if (criteria.to) clauses.push(`a.created_at < ${params.add(criteria.to)}::date + 1`);
    if (criteria.search?.trim()) {
      const term = params.add(likePattern(criteria.search));
      clauses.push(
        `(${unaccentLike('a.path', term)} OR ${unaccentLike('u.name', term)} OR ${unaccentLike('u.email', term)})`,
      );
    }
    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  }
}
