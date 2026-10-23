import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  type InventoryCategoryRepository,
} from '../domain/inventory-category.repository.js';
import { InventoryItem, type InventoryItemDetails } from '../domain/inventory-item.js';
import { INVENTORY_ITEM_REPOSITORY, type InventoryItemRepository } from '../domain/inventory-item.repository.js';
import type { StockMovement } from '../domain/stock-movement.js';
import { STOCK_MOVEMENT_REPOSITORY, type StockMovementRepository } from '../domain/stock-movement.repository.js';
import type { InventoryItemView } from './inventory-views.js';
import { assertItemReferences } from './item-references.js';
import { ItemPresenter } from './item-presenter.js';
import { StockMovementPublisher } from './stock-movement-publisher.js';

export interface CreateItemInput extends InventoryItemDetails {
  /** Opening stock, recorded as an `inicial` kardex movement. */
  initialStock?: number;
  actor: AuthenticatedActor;
}

/**
 * Creates an inventory item (legacy `inventory/index.php` `action=create`).
 * The opening stock becomes an `inicial` movement instead of a bare number.
 */
@Injectable()
export class CreateItemUseCase implements UseCase<CreateItemInput, InventoryItemView> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly presenter: ItemPresenter,
    private readonly publisher: StockMovementPublisher,
  ) {}

  async execute({ initialStock = 0, actor, ...details }: CreateItemInput): Promise<InventoryItemView> {
    const item = InventoryItem.create(details);
    let opening: StockMovement | null = null;
    await this.uow.runInTransaction(async () => {
      await assertItemReferences(this.items, this.categories, details, null);
      await this.items.save(item);
      if (initialStock > 0) {
        opening = item.recordMovement({
          type: 'inicial',
          quantity: initialStock,
          reason: 'Stock inicial',
          userId: actor.userId,
          at: this.clock.now(),
        });
        await this.items.save(item);
        await this.movements.save(opening);
      }
    });
    if (opening) await this.publisher.publish(item, opening);
    return this.presenter.presentOne(item);
  }
}
