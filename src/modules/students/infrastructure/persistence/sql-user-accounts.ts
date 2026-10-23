import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { Role } from '../../../../shared/domain/role.js';
import { isUniqueViolation, queryReturning } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { NewUserAccount, UserAccount, UserAccountPort } from '../../application/ports/user-account.port.js';

interface UserRow {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
}

const toAccount = (row: UserRow): UserAccount => ({
  id: Number(row.id),
  email: row.email,
  role: row.role,
  isActive: row.is_active === true,
});

/**
 * SQL adapter over the `users` table (identity context) used to create and
 * maintain portal accounts without importing the identity module.
 */
@Injectable()
export class SqlUserAccounts implements UserAccountPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<UserAccount | null> {
    const rows: UserRow[] = await (
      await this.db.manager()
    ).query('SELECT id, email, role, is_active FROM users WHERE id = $1', [id]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const rows: UserRow[] = await (
      await this.db.manager()
    ).query('SELECT id, email, role, is_active FROM users WHERE lower(email) = $1 LIMIT 1', [
      email.trim().toLowerCase(),
    ]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async create(account: NewUserAccount): Promise<number> {
    try {
      const [row] = await queryReturning<{ id: number }>(
        await this.db.manager(),
        'INSERT INTO users (name, email, password, role, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id',
        [account.name.slice(0, 150), account.email.trim().toLowerCase(), account.passwordHash, account.role],
      );
      return Number(row.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Ya existe un usuario con el correo ${account.email}.`);
      }
      throw error;
    }
  }

  async changePassword(userId: number, passwordHash: string): Promise<void> {
    await (await this.db.manager()).query('UPDATE users SET password = $1 WHERE id = $2', [passwordHash, userId]);
  }

  async displayNames(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const rows: { id: number; name: string }[] = await (
      await this.db.manager()
    ).query('SELECT id, name FROM users WHERE id = ANY($1)', [ids]);
    return new Map(rows.map((row) => [Number(row.id), row.name]));
  }
}
