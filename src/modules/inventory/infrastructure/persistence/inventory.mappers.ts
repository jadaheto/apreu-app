import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { InventoryCategory } from '../../domain/inventory-category.js';
import { InventoryItem } from '../../domain/inventory-item.js';
import { Sku } from '../../domain/sku.js';
import { StockMovement } from '../../domain/stock-movement.js';
import { InventoryCategoryOrmEntity } from './inventory-category.orm-entity.js';
import { InventoryItemOrmEntity } from './inventory-item.orm-entity.js';
import { StockMovementOrmEntity } from './stock-movement.orm-entity.js';

/** Translates `inventory_categories` rows ↔ {@link InventoryCategory}. */
export const InventoryCategoryMapper = {
  toDomain(row: InventoryCategoryOrmEntity): InventoryCategory {
    return InventoryCategory.restore(row.id, { name: row.name, createdAt: row.createdAt });
  },
  toPersistence(category: InventoryCategory): InventoryCategoryOrmEntity {
    const row = new InventoryCategoryOrmEntity();
    if (category.id !== null) row.id = category.id;
    row.name = category.name;
    return row;
  },
};

/** Translates `inventory_items` rows ↔ {@link InventoryItem}. */
export const InventoryItemMapper = {
  toDomain(row: InventoryItemOrmEntity): InventoryItem {
    return InventoryItem.restore(row.id, {
      categoryId: row.categoryId,
      name: row.name,
      sku: Sku.fromPersistence(row.sku),
      unit: row.unit,
      unitCost: Money.of(row.unitCost),
      salePrice: Money.of(row.salePrice),
      stock: row.stockQuantity,
      minStock: row.minStock,
      location: row.location,
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  },
  toPersistence(item: InventoryItem): InventoryItemOrmEntity {
    const row = new InventoryItemOrmEntity();
    if (item.id !== null) row.id = item.id;
    row.categoryId = item.categoryId;
    row.name = item.name;
    row.sku = item.sku.toString();
    row.unit = item.unit;
    row.unitCost = item.unitCost.amount.toFixed(2);
    row.salePrice = item.salePrice.amount.toFixed(2);
    row.stockQuantity = item.stock;
    row.minStock = item.minStock;
    row.location = item.location;
    row.isActive = item.isActive;
    return row;
  },
};

/** Translates `inventory_movements` rows ↔ {@link StockMovement}. */
export const StockMovementMapper = {
  toDomain(row: StockMovementOrmEntity): StockMovement {
    return StockMovement.restore(Number(row.id), {
      itemId: row.itemId,
      type: row.type,
      quantity: row.quantity,
      balanceAfter: row.balanceAfter,
      unitCost: Money.of(row.unitCost),
      reason: row.reason,
      reference: row.referenceType && row.referenceId ? { type: row.referenceType, id: row.referenceId } : null,
      userId: row.userId,
      createdAt: row.createdAt,
    });
  },
  toPersistence(movement: StockMovement): StockMovementOrmEntity {
    const row = new StockMovementOrmEntity();
    row.itemId = movement.itemId;
    row.type = movement.type;
    row.quantity = movement.quantity;
    row.balanceAfter = movement.balanceAfter;
    row.unitCost = movement.unitCost.amount.toFixed(2);
    row.reason = movement.reason;
    row.referenceType = movement.reference?.type ?? null;
    row.referenceId = movement.reference?.id ?? null;
    row.userId = movement.userId;
    row.createdAt = movement.createdAt;
    return row;
  },
};
