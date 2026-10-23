import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { InventoryItem } from '../../domain/inventory-item.js';
import type { InventoryItemRepository, InventoryItemSearchCriteria } from '../../domain/inventory-item.repository.js';
import { InventoryItemOrmEntity } from './inventory-item.orm-entity.js';
import { InventoryItemMapper } from './inventory.mappers.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';

const ALERT_CONDITIONS = {
  any: 'i.stock_quantity <= i.min_stock',
  low: 'i.stock_quantity > 0 AND i.stock_quantity <= i.min_stock',
  out: 'i.stock_quantity <= 0',
} as const;

@Injectable()
export class TypeOrmInventoryItemRepository implements InventoryItemRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<InventoryItem | null> {
    const row = await (await this.db.repository(InventoryItemOrmEntity)).findOneBy({ id });
    return row ? InventoryItemMapper.toDomain(row) : null;
  }

  async findByIdForUpdate(id: number): Promise<InventoryItem | null> {
    const row = await (
      await this.db.repository(InventoryItemOrmEntity)
    )
      .createQueryBuilder('i')
      .setLock('pessimistic_write')
      .where('i.id = :id', { id })
      .getOne();
    return row ? InventoryItemMapper.toDomain(row) : null;
  }

  async findBySku(sku: string): Promise<InventoryItem | null> {
    // `Sku` normalizes to upper case; `upper()` also matches legacy rows stored in lower case.
    const row = await (
      await this.db.repository(InventoryItemOrmEntity)
    )
      .createQueryBuilder('i')
      .where('upper(i.sku) = upper(:sku)', { sku })
      .getOne();
    return row ? InventoryItemMapper.toDomain(row) : null;
  }

  async search(criteria: InventoryItemSearchCriteria, page: PageRequest): Promise<Paginated<InventoryItem>> {
    const query = (await this.db.repository(InventoryItemOrmEntity)).createQueryBuilder('i');
    if (!criteria.includeInactive) query.andWhere('i.is_active = true');
    if (criteria.categoryId !== undefined)
      query.andWhere('i.category_id = :categoryId', { categoryId: criteria.categoryId });
    if (criteria.alert) query.andWhere(ALERT_CONDITIONS[criteria.alert]);
    if (criteria.search?.trim()) {
      const term = `%${criteria.search.trim()}%`;
      query.andWhere(
        new Brackets((q) =>
          q.where(unaccentLike('i.name', ':term'), { term }).orWhere(unaccentLike('i.sku', ':term'), { term }),
        ),
      );
    }
    const [rows, total] = await query.orderBy('i.name', 'ASC').skip(toOffset(page)).take(page.limit).getManyAndCount();
    return { items: rows.map(InventoryItemMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async countByCategory(categoryId: number): Promise<number> {
    return (await this.db.repository(InventoryItemOrmEntity)).countBy({ categoryId });
  }

  async save(item: InventoryItem): Promise<void> {
    const saved = await (
      await this.db.repository(InventoryItemOrmEntity)
    ).save(InventoryItemMapper.toPersistence(item));
    if (item.isNew) item.assignId(saved.id);
  }
}
