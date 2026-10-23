import type { Role } from '../../../../shared/domain/role.js';

/** Minimal view of a `users` row (identity context) that HR needs. */
export interface UserAccountSummary {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface NewUserAccount {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

/**
 * HR's own port to the user accounts owned by identity. Implemented with a
 * plain SQL adapter so HR never imports identity classes (guide rule 7).
 */
export interface UserAccountPort {
  findById(id: number): Promise<UserAccountSummary | null>;
  findByEmail(email: string): Promise<UserAccountSummary | null>;
  /** Creates the account and returns its id. */
  create(account: NewUserAccount): Promise<number>;
  /** Display names of the given users (missing ids are omitted). */
  namesByIds(ids: number[]): Promise<Map<number, string>>;
  /** Grants or revokes sign-in (`users.is_active`). */
  setActive(userId: number, active: boolean): Promise<void>;
}

export const USER_ACCOUNTS = Symbol('UserAccountPort');
