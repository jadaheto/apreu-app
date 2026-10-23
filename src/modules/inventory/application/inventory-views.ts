import type { InventoryCategory } from '../domain/inventory-category.js';
import type { InventoryItem, StockStatus } from '../domain/inventory-item.js';
import type { StockMovement, StockMovementType } from '../domain/stock-movement.js';

/** Read model of an inventory item. */
export interface InventoryItemView {
  id: number;
  sku: string;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  unit: string;
  unitCost: number;
  salePrice: number;
  stock: number;
  minStock: number;
  location: string | null;
  isActive: boolean;
  stockStatus: StockStatus;
  stockValue: number;
}

export interface InventoryCategoryView {
  id: number;
  name: string;
}

export interface StockMovementView {
  id: number;
  itemId: number;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  totalCost: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  userId: number | null;
  createdAt: Date;
}

export const toItemView = (item: InventoryItem, categoryName: string | null = null): InventoryItemView => ({
  id: item.id as number,
  sku: item.sku.toString(),
  name: item.name,
  categoryId: item.categoryId,
  categoryName,
  unit: item.unit,
  unitCost: item.unitCost.amount,
  salePrice: item.salePrice.amount,
  stock: item.stock,
  minStock: item.minStock,
  location: item.location,
  isActive: item.isActive,
  stockStatus: item.stockStatus,
  stockValue: item.stockValue.amount,
});

export const toCategoryView = (category: InventoryCategory): InventoryCategoryView => ({
  id: category.id as number,
  name: category.name,
});

export const toMovementView = (movement: StockMovement): StockMovementView => ({
  id: movement.id as number,
  itemId: movement.itemId,
  type: movement.type,
  quantity: movement.quantity,
  balanceAfter: movement.balanceAfter,
  unitCost: movement.unitCost.amount,
  totalCost: movement.totalCost.amount,
  reason: movement.reason,
  referenceType: movement.reference?.type ?? null,
  referenceId: movement.reference?.id ?? null,
  userId: movement.userId,
  createdAt: movement.createdAt,
});
