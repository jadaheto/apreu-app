import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { InventoryCategory } from '../../domain/inventory-category.js';
import type { InventoryCategoryRepository } from '../../domain/inventory-category.repository.js';
import { InventoryCategoryOrmEntity } from './inventory-category.orm-entity.js';
import { InventoryCategoryMapper } from './inventory.mappers.js';

@Injectable()
export class TypeOrmInventoryCategoryRepository implements InventoryCategoryRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<InventoryCategory | null> {
    const row = await (await this.db.repository(InventoryCategoryOrmEntity)).findOneBy({ id });
    return row ? InventoryCategoryMapper.toDomain(row) : null;
  }

  async findByName(name: string): Promise<InventoryCategory | null> {
    // Case- and accent-insensitive, as the legacy utf8mb4_general_ci collation (ADR-0008).
    const row = await (
      await this.db.repository(InventoryCategoryOrmEntity)
    )
      .createQueryBuilder('c')
      .where('lower(f_unaccent(c.name)) = lower(f_unaccent(:name))', { name: name.trim() })
      .orderBy('c.id', 'ASC')
      .getOne();
    return row ? InventoryCategoryMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<InventoryCategory[]> {
    if (ids.length === 0) return [];
    const rows = await (await this.db.repository(InventoryCategoryOrmEntity)).findBy({ id: In(ids) });
    return rows.map(InventoryCategoryMapper.toDomain);
  }

  async findAll(): Promise<InventoryCategory[]> {
    const rows = await (await this.db.repository(InventoryCategoryOrmEntity)).find({ order: { name: 'ASC' } });
    return rows.map(InventoryCategoryMapper.toDomain);
  }

  async save(category: InventoryCategory): Promise<void> {
    const saved = await (
      await this.db.repository(InventoryCategoryOrmEntity)
    ).save(InventoryCategoryMapper.toPersistence(category));
    if (category.isNew) category.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(InventoryCategoryOrmEntity)).delete({ id });
  }
}
