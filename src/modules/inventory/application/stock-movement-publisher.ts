import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import type { InventoryItem } from '../domain/inventory-item.js';
import type { StockMovement } from '../domain/stock-movement.js';
import { STOCK_MOVEMENT_RECORDED, type StockMovementRecordedPayload } from './integration-events.js';

/** Publishes `inventory.stock-movement-recorded` once the movement is committed. */
@Injectable()
export class StockMovementPublisher {
  constructor(@Inject(EVENT_BUS) private readonly bus: EventBusPort) {}

  async publish(item: InventoryItem, movement: StockMovement): Promise<void> {
    const payload: StockMovementRecordedPayload = {
      movementId: movement.id as number,
      itemId: item.id as number,
      sku: item.sku.toString(),
      itemName: item.name,
      type: movement.type,
      quantity: movement.quantity,
      balanceAfter: movement.balanceAfter,
      unitCost: movement.unitCost.amount,
      totalCost: movement.totalCost.amount,
      reason: movement.reason,
      occurredAt: movement.createdAt.toISOString(),
    };
    await this.bus.publish({ name: STOCK_MOVEMENT_RECORDED, occurredAt: movement.createdAt, payload: { ...payload } });
  }
}
