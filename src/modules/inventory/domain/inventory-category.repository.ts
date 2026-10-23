import type { InventoryCategory } from './inventory-category.js';

/** Output port for persisting {@link InventoryCategory} aggregates. */
export interface InventoryCategoryRepository {
  findById(id: number): Promise<InventoryCategory | null>;
  /** Case-insensitive lookup. */
  findByName(name: string): Promise<InventoryCategory | null>;
  findByIds(ids: number[]): Promise<InventoryCategory[]>;
  /** Ordered by name. */
  findAll(): Promise<InventoryCategory[]>;
  save(category: InventoryCategory): Promise<void>;
  delete(id: number): Promise<void>;
}

export const INVENTORY_CATEGORY_REPOSITORY = Symbol('InventoryCategoryRepository');
