import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
  type InventoryItemSearchCriteria,
} from '../domain/inventory-item.repository.js';
import type { InventoryItemView } from './inventory-views.js';
import { ItemPresenter } from './item-presenter.js';

export interface ListItemsInput extends InventoryItemSearchCriteria {
  page: PageRequest;
}

/** Lists items filtered by name/SKU, category and stock alert (RN-INV-09/10). */
@Injectable()
export class ListItemsUseCase implements UseCase<ListItemsInput, Paginated<InventoryItemView>> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    private readonly presenter: ItemPresenter,
  ) {}

  async execute({ page, ...criteria }: ListItemsInput): Promise<Paginated<InventoryItemView>> {
    const result = await this.items.search(criteria, page);
    return { ...result, items: await this.presenter.present(result.items) };
  }
}
