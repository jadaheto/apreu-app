import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { Role } from '../../../shared/domain/role.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { CreateItemUseCase } from '../application/create-item.use-case.js';
import { ItemPresenter } from '../application/item-presenter.js';
import { StockMovementPublisher } from '../application/stock-movement-publisher.js';
import {
  InMemoryInventoryCategoryRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryQueries,
  InMemoryStockMovementRepository,
} from './in-memory-inventory.js';

export const ADMIN: AuthenticatedActor = {
  userId: 1,
  role: Role.ADMIN,
  email: 'a@colegio.co',
  name: 'Admin',
  tenant: 'demo',
};

/** Wires the inventory application services over in-memory adapters. */
export const createInventoryFixture = () => {
  const items = new InMemoryInventoryItemRepository();
  const categories = new InMemoryInventoryCategoryRepository();
  const movements = new InMemoryStockMovementRepository();
  const queries = new InMemoryInventoryQueries(items, categories);
  const bus = new RecordingEventBus();
  const clock = new FixedClock();
  const uow = new FakeUnitOfWork();
  const presenter = new ItemPresenter(categories);
  const publisher = new StockMovementPublisher(bus);
  const createItem = new CreateItemUseCase(items, categories, movements, uow, clock, presenter, publisher);
  return { items, categories, movements, queries, bus, clock, uow, presenter, publisher, createItem };
};

export type InventoryFixture = ReturnType<typeof createInventoryFixture>;
