import type { Money } from '../../../../shared/domain/value-objects/money.vo.js';

/** RN-INV-08 KPIs over active items. */
export interface InventorySummary {
  totalItems: number;
  inventoryValue: Money;
  /** 0 < stock ≤ minimum. */
  lowStock: number;
  /** stock ≤ 0. */
  outOfStock: number;
}

export interface CategoryValuation {
  categoryId: number | null;
  categoryName: string | null;
  items: number;
  units: number;
  value: Money;
}

/** Aggregated read model of the inventory (computed by the database). */
export interface InventoryQueriesPort {
  summary(): Promise<InventorySummary>;
  valuationByCategory(): Promise<CategoryValuation[]>;
}

export const INVENTORY_QUERIES = Symbol('InventoryQueriesPort');
