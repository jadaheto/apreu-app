import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';

/** Soft delete (`is_active = 0`, RN-INV-05); verifies the item exists (bug 24). */
@Injectable()
export class DeactivateItemUseCase implements UseCase<number, void> {
  constructor(@Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository) {}

  async execute(id: number): Promise<void> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError('Ítem de inventario', id);
    item.deactivate();
    await this.items.save(item);
  }
}
