import type { Account } from './account.js';

/** Output port for persisting {@link Account} aggregates. */
export interface AccountRepository {
  findById(id: number): Promise<Account | null>;
  findByIds(ids: number[]): Promise<Account[]>;
  findByCode(code: string): Promise<Account | null>;
  /** Whole chart of accounts ordered by code (a school PUC has a few hundred rows). */
  findAll(): Promise<Account[]>;
  /** True when any journal line (in any status) uses the account. */
  hasMovements(id: number): Promise<boolean>;
  hasChildren(id: number): Promise<boolean>;
  save(account: Account): Promise<void>;
  delete(id: number): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');
