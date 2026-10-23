import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  CategoryValuation,
  InventoryQueriesPort,
  InventorySummary,
} from '../../application/ports/inventory-queries.port.js';

/** Aggregates over active items computed in SQL. */
@Injectable()
export class TypeOrmInventoryQueries implements InventoryQueriesPort {
  constructor(private readonly db: TenantDataSource) {}

  async summary(): Promise<InventorySummary> {
    const [row]: {
      totalItems: string;
      inventoryValue: string | null;
      lowStock: string | null;
      outOfStock: string | null;
    }[] = await (
      await this.db.manager()
    ).query(
      `SELECT COUNT(*)::int AS "totalItems",
                SUM(GREATEST(stock_quantity, 0) * unit_cost) AS "inventoryValue",
                COUNT(*) FILTER (WHERE stock_quantity > 0 AND stock_quantity <= min_stock)::int AS "lowStock",
                COUNT(*) FILTER (WHERE stock_quantity <= 0)::int AS "outOfStock"
         FROM inventory_items WHERE is_active = true`,
    );
    return {
      totalItems: Number(row.totalItems),
      inventoryValue: Money.of(row.inventoryValue ?? 0),
      lowStock: Number(row.lowStock ?? 0),
      outOfStock: Number(row.outOfStock ?? 0),
    };
  }

  async valuationByCategory(): Promise<CategoryValuation[]> {
    const rows: {
      categoryId: number | null;
      categoryName: string | null;
      items: string;
      units: string;
      value: string;
    }[] = await (
      await this.db.manager()
    ).query(
      `SELECT i.category_id AS "categoryId", c.name AS "categoryName", COUNT(*)::int AS items,
                SUM(GREATEST(i.stock_quantity, 0))::int AS units,
                SUM(GREATEST(i.stock_quantity, 0) * i.unit_cost) AS value
         FROM inventory_items i
         LEFT JOIN inventory_categories c ON c.id = i.category_id
         WHERE i.is_active = true
         GROUP BY i.category_id, c.name
         ORDER BY c.name NULLS FIRST`,
    );
    return rows.map((row) => ({
      categoryId: row.categoryId === null ? null : Number(row.categoryId),
      categoryName: row.categoryName,
      items: Number(row.items),
      units: Number(row.units),
      value: Money.of(row.value ?? 0),
    }));
  }
}
