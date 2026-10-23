import { Injectable } from '@nestjs/common';
import { ALL_ROLES, type Role } from '../../../../shared/domain/role.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { NewUserAccount, UserAccountPort, UserAccountSummary } from '../../domain/employees/user-account.port.js';
import { enumValue } from './enum-value.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

/**
 * Plain-SQL adapter over `users` (identity context) so HR does not depend on
 * identity's ORM classes (guide rule 7). New accounts are created with
 * `must_change_password = true` (column of migration identity-001), so the
 * temporary password must be replaced on first sign-in.
 */
@Injectable()
export class SqlUserAccounts implements UserAccountPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<UserAccountSummary | null> {
    return this.findOne('id = $1', id);
  }

  async findByEmail(email: string): Promise<UserAccountSummary | null> {
    return this.findOne('lower(email) = $1', email.trim().toLowerCase());
  }

  async create(account: NewUserAccount): Promise<number> {
    const [row]: { id: number }[] = await (
      await this.db.manager()
    ).query(
      `INSERT INTO users (name, email, password, role, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id`,
      [account.name.slice(0, 150), account.email, account.passwordHash, account.role],
    );
    return Number(row.id);
  }

  async namesByIds(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const rows: { id: number; name: string }[] = await (
      await this.db.manager()
    ).query('SELECT id, name FROM users WHERE id = ANY($1::int[])', [ids]);
    return new Map(rows.map((r) => [Number(r.id), r.name]));
  }

  async setActive(userId: number, active: boolean): Promise<void> {
    await (await this.db.manager()).query('UPDATE users SET is_active = $1 WHERE id = $2', [active, userId]);
  }

  private async findOne(condition: string, value: unknown): Promise<UserAccountSummary | null> {
    const rows: UserRow[] = await (
      await this.db.manager()
    ).query(`SELECT id, name, email, role, is_active FROM users WHERE ${condition} LIMIT 1`, [value]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      name: row.name,
      email: row.email,
      role: enumValue(row.role, ALL_ROLES, 'employee' as Role),
      isActive: row.is_active,
    };
  }
}
