import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import type { Money } from '../../../shared/domain/value-objects/money.vo.js';

/**
 * - `inicial`: opening stock when the item is created.
 * - `entrada`: purchase/receipt (adds).
 * - `salida`: sale/consumption (subtracts).
 * - `ajuste`: physical count; the quantity is the counted stock.
 */
export const STOCK_MOVEMENT_TYPES = ['inicial', 'entrada', 'salida', 'ajuste'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** Movement types users can register (the initial one is created with the item). */
export const MANUAL_MOVEMENT_TYPES = ['entrada', 'salida', 'ajuste'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export interface StockReference {
  type: string;
  id: string;
}

export interface StockMovementProps {
  itemId: number;
  type: StockMovementType;
  /** Signed variation (+ in, − out). */
  quantity: number;
  balanceAfter: number;
  unitCost: Money;
  reason: string | null;
  reference: StockReference | null;
  userId: number | null;
  createdAt: Date;
}

/**
 * Kardex line (`inventory_movements`). The legacy only overwrote
 * `stock_quantity` and discarded the reason (bug 22); every change of stock is
 * now recorded. Created through {@link InventoryItem.recordMovement}.
 */
export class StockMovement extends Entity<StockMovementProps> {
  private constructor(id: EntityId, props: StockMovementProps) {
    super(id, props);
  }

  /** Only {@link InventoryItem} creates movements, keeping the stock invariant. */
  static record(props: StockMovementProps): StockMovement {
    return new StockMovement(null, { ...props });
  }

  static restore(id: number, props: StockMovementProps): StockMovement {
    return new StockMovement(id, { ...props });
  }

  get itemId(): number {
    return this.props.itemId;
  }
  get type(): StockMovementType {
    return this.props.type;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get balanceAfter(): number {
    return this.props.balanceAfter;
  }
  get unitCost(): Money {
    return this.props.unitCost;
  }
  /** Cost of the moved units (absolute). */
  get totalCost(): Money {
    return this.props.unitCost.multiply(Math.abs(this.props.quantity));
  }
  get reason(): string | null {
    return this.props.reason;
  }
  get reference(): StockReference | null {
    return this.props.reference;
  }
  get userId(): number | null {
    return this.props.userId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
