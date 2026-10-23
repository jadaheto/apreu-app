import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  EmployeeLinkKey,
  EmploymentDirectoryPort,
  EmploymentStatus,
  EmploymentStatusPort,
} from '../../domain/employment-status.port.js';

/** Reads `employees.status` (HR context) with a plain query to avoid coupling to HR's ORM entities. */
@Injectable()
export class SqlEmploymentStatus implements EmploymentStatusPort, EmploymentDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async statusFor(userId: number, email: string): Promise<EmploymentStatus | null> {
    const rows: { status: string }[] = await (
      await this.db.manager()
    ).query(
      'SELECT status FROM employees WHERE user_id = $1 OR lower(email) = lower($2) ORDER BY (user_id = $1) IS TRUE DESC LIMIT 1',
      [userId, email],
    );
    return rows[0]?.status ?? null;
  }

  /** Links by `user_id` first and by normalized e-mail otherwise (no name heuristics, legacy bug B21). */
  async statusesFor(users: readonly EmployeeLinkKey[]): Promise<ReadonlyMap<number, EmploymentStatus>> {
    if (!users.length) return new Map();
    const ids = users.map((user) => user.userId);
    const emails = users.map((user) => user.email.trim().toLowerCase());
    const rows: { user_id: number | null; email: string | null; status: string }[] = await (
      await this.db.manager()
    ).query(
      'SELECT user_id, lower(trim(email)) AS email, status FROM employees WHERE user_id = ANY($1) OR lower(trim(email)) = ANY($2)',
      [ids, emails],
    );
    const byUserId = new Map(
      rows.filter((row) => row.user_id !== null).map((row) => [Number(row.user_id), row.status]),
    );
    const byEmail = new Map(rows.filter((row) => row.email).map((row) => [row.email as string, row.status]));
    const result = new Map<number, EmploymentStatus>();
    users.forEach(({ userId, email }) => {
      const status = byUserId.get(userId) ?? byEmail.get(email.trim().toLowerCase());
      if (status !== undefined) result.set(userId, status);
    });
    return result;
  }
}
