import { Injectable } from '@nestjs/common';
import { Brackets, type SelectQueryBuilder } from 'typeorm';
import { toOffset, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { EmployeeSticker } from '../../domain/stickers/employee-sticker.js';
import type {
  EmployeeStickerRepository,
  StickerCriteria,
  StickerScope,
  StickerStats,
} from '../../domain/stickers/employee-sticker.repository.js';
import { EmployeeStickerMapper } from './employee-sticker.mapper.js';
import { EmployeeStickerOrmEntity } from './employee-sticker.orm-entity.js';

/** TypeORM adapter of {@link EmployeeStickerRepository}. */
@Injectable()
export class TypeOrmEmployeeStickerRepository implements EmployeeStickerRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<EmployeeSticker | null> {
    const row = await (await this.db.repository(EmployeeStickerOrmEntity)).findOneBy({ id });
    return row ? EmployeeStickerMapper.toDomain(row) : null;
  }

  async search(criteria: StickerCriteria, page: PageRequest): Promise<Paginated<EmployeeSticker>> {
    const query = await this.scoped(criteria.scope);
    if (criteria.employeeId !== undefined)
      query.andWhere('s.employee_id = :employeeId', { employeeId: criteria.employeeId });
    if (criteria.filter === 'unread') query.andWhere('s.is_read = false');
    if (criteria.filter === 'urgent') query.andWhere("s.priority = 'urgent'");
    const [rows, total] = await query
      .orderBy('s.priority', 'DESC') // 'urgent' sorts after 'normal'
      .addOrderBy('s.created_at', 'DESC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(EmployeeStickerMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async stats(scope: StickerScope | null): Promise<StickerStats> {
    const row = await (
      await this.scoped(scope)
    )
      .select('COUNT(*)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE NOT s.is_read)::int', 'unread')
      .addSelect("COUNT(*) FILTER (WHERE NOT s.is_read AND s.priority = 'urgent')::int", 'urgent')
      .getRawOne();
    return { total: Number(row?.total ?? 0), unread: Number(row?.unread ?? 0), urgent: Number(row?.urgent ?? 0) };
  }

  async pendingFor(employeeId: number, limit: number): Promise<EmployeeSticker[]> {
    const rows = await (
      await this.db.repository(EmployeeStickerOrmEntity)
    )
      .createQueryBuilder('s')
      .where('s.employee_id = :employeeId AND s.is_read = false', { employeeId })
      .orderBy('s.priority', 'DESC') // 'urgent' sorts after 'normal'
      .addOrderBy('s.created_at', 'DESC')
      .take(limit)
      .getMany();
    return rows.map(EmployeeStickerMapper.toDomain);
  }

  async save(sticker: EmployeeSticker): Promise<void> {
    const saved = await (
      await this.db.repository(EmployeeStickerOrmEntity)
    ).save(EmployeeStickerMapper.toPersistence(sticker));
    if (sticker.isNew) sticker.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(EmployeeStickerOrmEntity)).delete({ id });
  }

  private async scoped(scope: StickerScope | null): Promise<SelectQueryBuilder<EmployeeStickerOrmEntity>> {
    const query = (await this.db.repository(EmployeeStickerOrmEntity)).createQueryBuilder('s');
    if (scope) {
      query.where(
        new Brackets((q) =>
          q
            .where('s.employee_id = :ownEmployee', { ownEmployee: scope.employeeId ?? 0 })
            .orWhere('s.created_by = :userId', {
              userId: scope.userId,
            }),
        ),
      );
    }
    return query;
  }
}
