import { Injectable } from '@nestjs/common';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { StockMovement } from '../../domain/stock-movement.js';
import type { StockMovementRepository } from '../../domain/stock-movement.repository.js';
import { StockMovementMapper } from './inventory.mappers.js';
import { StockMovementOrmEntity } from './stock-movement.orm-entity.js';

@Injectable()
export class TypeOrmStockMovementRepository implements StockMovementRepository {
  constructor(private readonly db: TenantDataSource) {}

  async save(movement: StockMovement): Promise<void> {
    const saved = await (
      await this.db.repository(StockMovementOrmEntity)
    ).save(StockMovementMapper.toPersistence(movement));
    movement.assignId(Number(saved.id));
  }

  async listByItem(itemId: number, page: PageRequest): Promise<Paginated<StockMovement>> {
    const [rows, total] = await (
      await this.db.repository(StockMovementOrmEntity)
    ).findAndCount({
      where: { itemId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: toOffset(page),
      take: page.limit,
    });
    return { items: rows.map(StockMovementMapper.toDomain), total, page: page.page, limit: page.limit };
  }
}
