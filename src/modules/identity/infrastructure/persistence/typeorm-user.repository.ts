import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { isUniqueViolation, likePattern, unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import type { User } from '../../domain/user.js';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { Role } from '../../../../shared/domain/role.js';
import type { UserRepository, UserSearchCriteria, UserStatistics } from '../../domain/user.repository.js';
import { UserMapper } from './user.mapper.js';
import { UserOrmEntity } from './user.orm-entity.js';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<User | null> {
    const row = await (await this.db.repository(UserOrmEntity)).findOneBy({ id });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await (
      await this.db.repository(UserOrmEntity)
    )
      .createQueryBuilder('u')
      .where('lower(u.email) = lower(:email)', { email })
      .getOne();
    return row ? UserMapper.toDomain(row) : null;
  }

  async search(criteria: UserSearchCriteria, page: PageRequest): Promise<Paginated<User>> {
    const query = (await this.db.repository(UserOrmEntity)).createQueryBuilder('u');
    if (criteria.role) query.andWhere('u.role = :role', { role: criteria.role });
    if (criteria.isActive !== undefined) query.andWhere('u.is_active = :active', { active: criteria.isActive });
    if (criteria.search) {
      const term = likePattern(criteria.search);
      query.andWhere(
        new Brackets((q) =>
          q.where(unaccentLike('u.name', ':term'), { term }).orWhere(unaccentLike('u.email', ':term'), { term }),
        ),
      );
    }
    const [rows, total] = await query.orderBy('u.name', 'ASC').skip(toOffset(page)).take(page.limit).getManyAndCount();
    return { items: rows.map(UserMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async statistics(): Promise<UserStatistics> {
    const rows: { role: Role; total: string; inactive: string }[] = await (
      await this.db.repository(UserOrmEntity)
    )
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE u.is_active IS NOT TRUE)::int', 'inactive')
      .groupBy('u.role')
      .getRawMany();
    const byRole: UserStatistics['byRole'] = {};
    rows.forEach((row) => (byRole[row.role] = Number(row.total)));
    return {
      total: rows.reduce((acc, row) => acc + Number(row.total), 0),
      inactive: rows.reduce((acc, row) => acc + Number(row.inactive ?? 0), 0),
      byRole,
    };
  }

  /** Inserts or updates; a concurrent duplicate e-mail surfaces as {@link ConflictError}. */
  async save(user: User): Promise<void> {
    try {
      const saved = await (await this.db.repository(UserOrmEntity)).save(UserMapper.toPersistence(user));
      if (user.isNew) user.assignId(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Ya existe un usuario con ese correo electrónico.');
      }
      throw error;
    }
  }
}
