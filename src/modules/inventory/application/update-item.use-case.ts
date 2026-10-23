import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  type InventoryCategoryRepository,
} from '../domain/inventory-category.repository.js';
import type { InventoryItemDetails } from '../domain/inventory-item.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';
import type { InventoryItemView } from './inventory-views.js';
import { assertItemReferences } from './item-references.js';
import { ItemPresenter } from './item-presenter.js';

export interface UpdateItemInput extends InventoryItemDetails {
  id: number;
}

/**
 * Edits an item's data. Fixes bug 23: the stock cannot be overwritten here
 * (only through movements) and the item must exist.
 */
@Injectable()
export class UpdateItemUseCase implements UseCase<UpdateItemInput, InventoryItemView> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
    private readonly presenter: ItemPresenter,
  ) {}

  async execute({ id, ...details }: UpdateItemInput): Promise<InventoryItemView> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError('Ítem de inventario', id);
    await assertItemReferences(this.items, this.categories, details, id);
    item.update(details);
    await this.items.save(item);
    return this.presenter.presentOne(item);
  }
}
