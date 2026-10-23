import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { InventoryCategoryRepository } from '../domain/inventory-category.repository.js';
import type { InventoryItemRepository } from '../domain/inventory-item.repository.js';
import { Sku } from '../domain/sku.js';

/**
 * Checks shared by create/update (bug 23): the SKU is unique (409 instead of a
 * raw SQL error) and the category exists.
 */
export const assertItemReferences = async (
  items: InventoryItemRepository,
  categories: InventoryCategoryRepository,
  input: { sku: string; categoryId: number | null },
  itemId: number | null,
): Promise<void> => {
  const sku = Sku.create(input.sku).toString();
  const homonym = await items.findBySku(sku);
  if (homonym && homonym.id !== itemId) throw new ConflictError(`Ya existe un ítem con el SKU ${sku}.`);
  if (input.categoryId !== null && !(await categories.findById(input.categoryId))) {
    throw new NotFoundError('Categoría de inventario', input.categoryId);
  }
};
