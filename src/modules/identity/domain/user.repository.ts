import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { Role } from '../../../shared/domain/role.js';
import type { User } from './user.js';

export interface UserSearchCriteria {
  search?: string;
  role?: Role;
  isActive?: boolean;
}

/** Number of accounts per role plus the inactive ones. */
export interface UserStatistics {
  total: number;
  inactive: number;
  byRole: Partial<Record<Role, number>>;
}

/** Output port for persisting {@link User} aggregates. */
export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  search(criteria: UserSearchCriteria, page: PageRequest): Promise<Paginated<User>>;
  statistics(): Promise<UserStatistics>;
  /** Inserts or updates; assigns the id to new users. */
  save(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
