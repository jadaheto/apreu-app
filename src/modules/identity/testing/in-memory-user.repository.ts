import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import { toOffset } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { User } from '../domain/user.js';
import type { UserRepository, UserSearchCriteria, UserStatistics } from '../domain/user.repository.js';

export class InMemoryUserRepository implements UserRepository {
  readonly store = new InMemoryStore<User>();

  async findById(id: number): Promise<User | null> {
    return this.store.get(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.store.all().find((user) => user.email.toString() === email) ?? null;
  }

  async search(criteria: UserSearchCriteria, page: PageRequest): Promise<Paginated<User>> {
    const term = criteria.search?.toLowerCase();
    const matches = this.store
      .all()
      .filter((u) => !criteria.role || u.role === criteria.role)
      .filter((u) => criteria.isActive === undefined || u.isActive === criteria.isActive)
      .filter((u) => !term || u.name.toLowerCase().includes(term) || u.email.toString().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }

  async statistics(): Promise<UserStatistics> {
    const users = this.store.all();
    const byRole: UserStatistics['byRole'] = {};
    users.forEach((user) => (byRole[user.role] = (byRole[user.role] ?? 0) + 1));
    return { total: users.length, inactive: users.filter((user) => !user.isActive).length, byRole };
  }

  async save(user: User): Promise<void> {
    this.store.save(user);
  }
}
