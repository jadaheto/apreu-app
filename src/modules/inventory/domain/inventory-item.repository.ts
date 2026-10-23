import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { InventoryItem } from './inventory-item.js';

/**
 * Stock alert filter. Fixes bug 26 (the legacy filter included out-of-stock
 * items while the "low stock" KPI did not): `low` = 0 < stock ≤ minimum,
 * `out` = stock ≤ 0, `any` = stock ≤ minimum.
 */
export type StockAlertFilter = 'any' | 'low' | 'out';

export interface InventoryItemSearchCriteria {
  /** Name or SKU. */
  search?: string;
  categoryId?: number;
  alert?: StockAlertFilter;
  /** Defaults to active items only (RN-INV-05). */
  includeInactive?: boolean;
}

/** Output port for persisting {@link InventoryItem} aggregates. */
export interface InventoryItemRepository {
  findById(id: number): Promise<InventoryItem | null>;
  /** Loads the item locking its row until the transaction ends (bug 22: lost updates). */
  findByIdForUpdate(id: number): Promise<InventoryItem | null>;
  findBySku(sku: string): Promise<InventoryItem | null>;
  /** Ordered by name (RN-INV-10, now paginated). */
  search(criteria: InventoryItemSearchCriteria, page: PageRequest): Promise<Paginated<InventoryItem>>;
  /** Items (active or not) of the category. */
  countByCategory(categoryId: number): Promise<number>;
  save(item: InventoryItem): Promise<void>;
}

export const INVENTORY_ITEM_REPOSITORY = Symbol('InventoryItemRepository');
