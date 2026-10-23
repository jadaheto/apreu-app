import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { mapPage, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';
import { STOCK_MOVEMENT_REPOSITORY, type StockMovementRepository } from '../domain/stock-movement.repository.js';
import { toMovementView, type StockMovementView } from './inventory-views.js';

export interface ListStockMovementsInput {
  itemId: number;
  page: PageRequest;
}

/** Kardex of an item, newest first (did not exist in the legacy). */
@Injectable()
export class ListStockMovementsUseCase implements UseCase<ListStockMovementsInput, Paginated<StockMovementView>> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
  ) {}

  async execute({ itemId, page }: ListStockMovementsInput): Promise<Paginated<StockMovementView>> {
    if (!(await this.items.findById(itemId))) throw new NotFoundError('Ítem de inventario', itemId);
    return mapPage(await this.movements.listByItem(itemId, page), toMovementView);
  }
}
