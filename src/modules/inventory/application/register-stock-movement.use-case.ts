import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';
import { MANUAL_MOVEMENT_TYPES, type ManualMovementType } from '../domain/stock-movement.js';
import { STOCK_MOVEMENT_REPOSITORY, type StockMovementRepository } from '../domain/stock-movement.repository.js';
import { toMovementView, type InventoryItemView, type StockMovementView } from './inventory-views.js';
import { ItemPresenter } from './item-presenter.js';
import { StockMovementPublisher } from './stock-movement-publisher.js';

export interface RegisterStockMovementInput {
  itemId: number;
  type: ManualMovementType;
  /** Units for entrada/salida; counted stock for ajuste. */
  quantity: number;
  /** Purchase unit cost of an entrada (weighted average). */
  unitCost?: number;
  reason?: string;
  actor: AuthenticatedActor;
}

export interface RegisterStockMovementOutput {
  item: InventoryItemView;
  movement: StockMovementView;
  /** e.g. "Entrada de 5 unidades registrada. Stock actual: 12". */
  message: string;
}

const LABELS: Record<ManualMovementType, string> = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };

/**
 * Registers an entrada, salida or ajuste (legacy `action=adjust`). Fixes bug
 * 22: the row is locked inside a transaction, the reason is kept in the
 * kardex and an unknown type is rejected instead of being treated as salida.
 */
@Injectable()
export class RegisterStockMovementUseCase implements UseCase<RegisterStockMovementInput, RegisterStockMovementOutput> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly presenter: ItemPresenter,
    private readonly publisher: StockMovementPublisher,
  ) {}

  async execute(input: RegisterStockMovementInput): Promise<RegisterStockMovementOutput> {
    Guard.oneOf(input.type, MANUAL_MOVEMENT_TYPES, 'tipo de movimiento');
    const { item, movement } = await this.uow.runInTransaction(async () => {
      const locked = await this.items.findByIdForUpdate(input.itemId);
      if (!locked) throw new NotFoundError('Ítem de inventario', input.itemId);
      const recorded = locked.recordMovement({
        type: input.type,
        quantity: input.quantity,
        unitCost: input.unitCost === undefined ? undefined : Money.of(input.unitCost),
        reason: input.reason,
        userId: input.actor.userId,
        at: this.clock.now(),
      });
      await this.items.save(locked);
      await this.movements.save(recorded);
      return { item: locked, movement: recorded };
    });
    await this.publisher.publish(item, movement);
    return {
      item: await this.presenter.presentOne(item),
      movement: toMovementView(movement),
      message: `${LABELS[input.type]} de ${Math.abs(movement.quantity)} unidades registrada. Stock actual: ${item.stock}`,
    };
  }
}
