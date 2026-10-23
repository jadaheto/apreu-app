import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { INVENTORY_QUERIES, type InventoryQueriesPort } from './ports/inventory-queries.port.js';

export interface InventoryValuationView {
  categories: { categoryId: number | null; categoryName: string; items: number; units: number; value: number }[];
  totalUnits: number;
  totalValue: number;
}

/**
 * Inventory valuation by category: units in stock × unit cost (weighted
 * average cost, updated by purchases), active items only.
 */
@Injectable()
export class GetInventoryValuationUseCase implements UseCase<void, InventoryValuationView> {
  constructor(@Inject(INVENTORY_QUERIES) private readonly queries: InventoryQueriesPort) {}

  async execute(): Promise<InventoryValuationView> {
    const rows = await this.queries.valuationByCategory();
    return {
      categories: rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName ?? 'Sin categoría',
        items: row.items,
        units: row.units,
        value: row.value.amount,
      })),
      totalUnits: rows.reduce((acc, row) => acc + row.units, 0),
      totalValue: rows.reduce((acc, row) => acc.add(row.value), Money.zero()).amount,
    };
  }
}
