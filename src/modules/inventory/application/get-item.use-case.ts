import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';
import type { InventoryItemView } from './inventory-views.js';
import { ItemPresenter } from './item-presenter.js';

/** One inventory item. */
@Injectable()
export class GetItemUseCase implements UseCase<number, InventoryItemView> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    private readonly presenter: ItemPresenter,
  ) {}

  async execute(id: number): Promise<InventoryItemView> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError('Ítem de inventario', id);
    return this.presenter.presentOne(item);
  }
}
