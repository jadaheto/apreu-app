import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';
import type { InventoryItemView } from './inventory-views.js';
import { ItemPresenter } from './item-presenter.js';

/** Upper bound of alerts returned at once (a school inventory has a few hundred items). */
const MAX_ALERTS = 500;

export interface StockAlertsView {
  outOfStock: InventoryItemView[];
  lowStock: InventoryItemView[];
}

/**
 * Minimum-stock alerts of active items: out of stock (stock ≤ 0) and low
 * stock (0 < stock ≤ minimum), the most critical first.
 */
@Injectable()
export class GetStockAlertsUseCase implements UseCase<void, StockAlertsView> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    private readonly presenter: ItemPresenter,
  ) {}

  async execute(): Promise<StockAlertsView> {
    const page = { page: 1, limit: MAX_ALERTS };
    const [out, low] = await Promise.all([
      this.items.search({ alert: 'out' }, page),
      this.items.search({ alert: 'low' }, page),
    ]);
    const lowSorted = [...low.items].sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock));
    return { outOfStock: await this.presenter.present(out.items), lowStock: await this.presenter.present(lowSorted) };
  }
}
