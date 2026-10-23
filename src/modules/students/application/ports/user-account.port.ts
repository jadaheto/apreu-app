import type { Role } from '../../../../shared/domain/role.js';

/** Minimal view of a row of `users` needed to provision portal accounts. */
export interface UserAccount {
  id: number;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface NewUserAccount {
  name: string;
  email: string;
  passwordHash: string;
  role: Role.STUDENT | Role.PARENT;
}

/**
 * Port to create and maintain the portal accounts of students and guardians
 * in the `users` table without depending on the identity module's classes.
 */
export interface UserAccountPort {
  findById(id: number): Promise<UserAccount | null>;
  findByEmail(email: string): Promise<UserAccount | null>;
  /** Inserts an active user and returns its id. */
  create(account: NewUserAccount): Promise<number>;
  changePassword(userId: number, passwordHash: string): Promise<void>;
  /** Display names by user id (requester/reviewer of incidents). Unknown ids are omitted. */
  displayNames(ids: number[]): Promise<Map<number, string>>;
}

export const USER_ACCOUNTS = Symbol('UserAccountPort');
