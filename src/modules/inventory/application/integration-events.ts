/** Integration event published by inventory after every stock movement (additional to the catalogue). */
export const STOCK_MOVEMENT_RECORDED = 'inventory.stock-movement-recorded';

export interface StockMovementRecordedPayload {
  movementId: number;
  itemId: number;
  sku: string;
  itemName: string;
  type: string;
  /** Signed variation. */
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  totalCost: number;
  reason: string | null;
  occurredAt: string;
}
