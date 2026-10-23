import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  type InventoryCategoryRepository,
} from '../domain/inventory-category.repository.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';

/** Deletes a category that has no items. */
@Injectable()
export class DeleteCategoryUseCase implements UseCase<number, void> {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
  ) {}

  async execute(id: number): Promise<void> {
    if (!(await this.categories.findById(id))) throw new NotFoundError('Categoría de inventario', id);
    const count = await this.items.countByCategory(id);
    if (count > 0) throw new ConflictError(`No se puede eliminar: la categoría tiene ${count} ítem(s).`);
    await this.categories.delete(id);
  }
}
