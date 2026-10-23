import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { Sku } from './sku.js';
import { StockMovement, type StockMovementType, type StockReference } from './stock-movement.js';

/** RN-INV-07: `out` if stock ≤ 0, `low` if stock ≤ minimum, otherwise `ok`. */
export type StockStatus = 'out' | 'low' | 'ok';

export interface InventoryItemProps {
  categoryId: number | null;
  name: string;
  sku: Sku;
  unit: string;
  unitCost: Money;
  salePrice: Money;
  stock: number;
  minStock: number;
  location: string | null;
  isActive: boolean;
  createdAt: Date | null;
}

/** Editable data of an item; the stock is never edited directly (bug 23). */
export interface InventoryItemDetails {
  categoryId: number | null;
  name: string;
  sku: string;
  unit?: string;
  unitCost: number;
  salePrice: number;
  minStock: number;
  location?: string | null;
}

export interface MovementRequest {
  type: StockMovementType;
  quantity: number;
  /** Purchase cost of an `entrada`; updates the weighted average cost. */
  unitCost?: Money;
  reason?: string | null;
  reference?: StockReference | null;
  userId: number | null;
  at: Date;
}

const assertCount = (value: number, field: string, min: number): void => {
  if (!Number.isInteger(value) || value < min) {
    throw new BusinessRuleViolationError(
      `El campo "${field}" debe ser un número entero mayor o igual a ${min}.`,
      'INVALID_QUANTITY',
      { field },
    );
  }
};

/**
 * Inventory item (`inventory_items`, legacy `inventory/index.php`).
 *
 * Invariants: stock is a non-negative integer changed only through
 * {@link recordMovement} (kardex); cost and price are non-negative
 * (RN-INV-02, only HTML-validated in the legacy). Inactive items keep their
 * history but accept no movements (RN-INV-05).
 */
export class InventoryItem extends Entity<InventoryItemProps> {
  private constructor(id: EntityId, props: InventoryItemProps) {
    super(id, props);
  }

  static create(details: InventoryItemDetails): InventoryItem {
    const item = new InventoryItem(null, {
      categoryId: null,
      name: '',
      sku: Sku.create(details.sku),
      unit: 'und',
      unitCost: Money.zero(),
      salePrice: Money.zero(),
      stock: 0,
      minStock: 0,
      location: null,
      isActive: true,
      createdAt: null,
    });
    item.update(details);
    return item;
  }

  static restore(id: number, props: InventoryItemProps): InventoryItem {
    return new InventoryItem(id, { ...props });
  }

  get categoryId(): number | null {
    return this.props.categoryId;
  }
  get name(): string {
    return this.props.name;
  }
  get sku(): Sku {
    return this.props.sku;
  }
  get unit(): string {
    return this.props.unit;
  }
  get unitCost(): Money {
    return this.props.unitCost;
  }
  get salePrice(): Money {
    return this.props.salePrice;
  }
  get stock(): number {
    return this.props.stock;
  }
  get minStock(): number {
    return this.props.minStock;
  }
  get location(): string | null {
    return this.props.location;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
  get stockStatus(): StockStatus {
    if (this.props.stock <= 0) return 'out';
    return this.props.stock <= this.props.minStock ? 'low' : 'ok';
  }
  /** RN-INV-06: stock × unit cost. */
  get stockValue(): Money {
    return this.props.unitCost.multiply(this.props.stock);
  }

  update(details: InventoryItemDetails): void {
    const name = details.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 200, 'nombre');
    const unit = details.unit?.trim() || 'und';
    Guard.againstMaxLength(unit, 20, 'unidad');
    const location = details.location?.trim() || null;
    Guard.againstMaxLength(location, 100, 'ubicación');
    const unitCost = Money.of(details.unitCost);
    const salePrice = Money.of(details.salePrice);
    Guard.againstNegative(unitCost.cents, 'costo unitario');
    Guard.againstNegative(salePrice.cents, 'precio de venta');
    assertCount(details.minStock, 'stock mínimo', 0);
    Object.assign(this.props, {
      categoryId: details.categoryId ?? null,
      name,
      sku: Sku.create(details.sku),
      unit,
      unitCost,
      salePrice,
      minStock: details.minStock,
      location,
    });
  }

  deactivate(): void {
    this.props.isActive = false;
  }

  /**
   * Applies a stock movement and returns the kardex line (RN-INV-03).
   * Never lets the stock go negative ("No hay suficiente stock para esta salida").
   */
  recordMovement(request: MovementRequest): StockMovement {
    if (this.isNew) throw new Error('El ítem debe guardarse antes de registrar movimientos.');
    if (!this.props.isActive) {
      throw new BusinessRuleViolationError('El ítem está inactivo; no admite movimientos.', 'ITEM_INACTIVE');
    }
    const reason = request.reason?.trim() || null;
    Guard.againstMaxLength(reason, 255, 'motivo');
    const delta = this.deltaFor(request);
    const movementCost = request.type === 'entrada' && request.unitCost ? request.unitCost : this.props.unitCost;
    if (request.type === 'entrada' && request.unitCost)
      this.applyWeightedAverageCost(request.quantity, request.unitCost);
    this.props.stock += delta;
    return StockMovement.record({
      itemId: this.id as number,
      type: request.type,
      quantity: delta,
      balanceAfter: this.props.stock,
      unitCost: movementCost,
      reason,
      reference: request.reference ?? null,
      userId: request.userId,
      createdAt: request.at,
    });
  }

  private deltaFor({ type, quantity, reason }: MovementRequest): number {
    switch (type) {
      case 'inicial':
        assertCount(quantity, 'cantidad', 1);
        if (this.props.stock !== 0) {
          throw new BusinessRuleViolationError(
            'El stock inicial sólo se registra en ítems sin existencias.',
            'INITIAL_STOCK_EXISTS',
          );
        }
        return quantity;
      case 'entrada':
        assertCount(quantity, 'cantidad', 1);
        return quantity;
      case 'salida':
        assertCount(quantity, 'cantidad', 1);
        if (quantity > this.props.stock) {
          throw new BusinessRuleViolationError('No hay suficiente stock para esta salida.', 'INSUFFICIENT_STOCK', {
            available: this.props.stock,
          });
        }
        return -quantity;
      case 'ajuste': {
        assertCount(quantity, 'cantidad contada', 0);
        Guard.againstEmpty(reason?.trim(), 'motivo del ajuste');
        const delta = quantity - this.props.stock;
        if (delta === 0) {
          throw new BusinessRuleViolationError('La cantidad contada es igual al stock actual.', 'NO_STOCK_CHANGE');
        }
        return delta;
      }
      default:
        throw new BusinessRuleViolationError(`Tipo de movimiento inválido: "${String(type)}".`, 'INVALID_OPTION');
    }
  }

  /** Weighted average cost ("costo promedio ponderado") after a purchase. */
  private applyWeightedAverageCost(quantity: number, purchaseCost: Money): void {
    Guard.againstNegative(purchaseCost.cents, 'costo de la entrada');
    const current = Math.max(this.props.stock, 0);
    const totalCents = this.props.unitCost.cents * current + purchaseCost.cents * quantity;
    this.props.unitCost = Money.of(Math.round(totalCents / (current + quantity)) / 100);
  }
}
