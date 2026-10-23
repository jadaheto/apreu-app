import { toOffset, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type {
  CategoryValuation,
  InventoryQueriesPort,
  InventorySummary,
} from '../application/ports/inventory-queries.port.js';
import type { InventoryCategory } from '../domain/inventory-category.js';
import type { InventoryCategoryRepository } from '../domain/inventory-category.repository.js';
import type { InventoryItem } from '../domain/inventory-item.js';
import type { InventoryItemRepository, InventoryItemSearchCriteria } from '../domain/inventory-item.repository.js';
import type { StockMovement } from '../domain/stock-movement.js';
import type { StockMovementRepository } from '../domain/stock-movement.repository.js';

const page = <T>(items: T[], request: PageRequest): Paginated<T> => {
  const offset = toOffset(request);
  return { items: items.slice(offset, offset + request.limit), total: items.length, ...request };
};

export class InMemoryInventoryCategoryRepository implements InventoryCategoryRepository {
  readonly store = new InMemoryStore<InventoryCategory>();
  async findById(id: number) {
    return this.store.get(id);
  }
  async findByName(name: string) {
    return this.store.all().find((c) => c.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
  }
  async findByIds(ids: number[]) {
    return this.store.all().filter((c) => ids.includes(c.id as number));
  }
  async findAll() {
    return this.store.all().sort((a, b) => a.name.localeCompare(b.name));
  }
  async save(category: InventoryCategory) {
    this.store.save(category);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryInventoryItemRepository implements InventoryItemRepository {
  readonly store = new InMemoryStore<InventoryItem>();
  locks = 0;
  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIdForUpdate(id: number) {
    this.locks++;
    return this.store.get(id);
  }
  async findBySku(sku: string) {
    return this.store.all().find((i) => i.sku.toString() === sku) ?? null;
  }
  async search(criteria: InventoryItemSearchCriteria, request: PageRequest) {
    const term = criteria.search?.toLowerCase();
    const alert = {
      any: (i: InventoryItem) => i.stock <= i.minStock,
      low: (i: InventoryItem) => i.stock > 0 && i.stock <= i.minStock,
      out: (i: InventoryItem) => i.stock <= 0,
    };
    const matches = this.store
      .all()
      .filter((i) => criteria.includeInactive || i.isActive)
      .filter((i) => criteria.categoryId === undefined || i.categoryId === criteria.categoryId)
      .filter((i) => !criteria.alert || alert[criteria.alert](i))
      .filter((i) => !term || i.name.toLowerCase().includes(term) || i.sku.toString().toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    return page(matches, request);
  }
  async countByCategory(categoryId: number) {
    return this.store.all().filter((i) => i.categoryId === categoryId).length;
  }
  async save(item: InventoryItem) {
    this.store.save(item);
  }
}

export class InMemoryStockMovementRepository implements StockMovementRepository {
  readonly store = new InMemoryStore<StockMovement>();
  async save(movement: StockMovement) {
    this.store.save(movement);
  }
  async listByItem(itemId: number, request: PageRequest) {
    const matches = this.store
      .all()
      .filter((m) => m.itemId === itemId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id as number) - (a.id as number));
    return page(matches, request);
  }
}

export class InMemoryInventoryQueries implements InventoryQueriesPort {
  constructor(
    private readonly items: InMemoryInventoryItemRepository,
    private readonly categories: InMemoryInventoryCategoryRepository,
  ) {}

  private active() {
    return this.items.store.all().filter((i) => i.isActive);
  }

  async summary(): Promise<InventorySummary> {
    const active = this.active();
    return {
      totalItems: active.length,
      inventoryValue: active.reduce((acc, i) => acc.add(i.stockValue), Money.zero()),
      lowStock: active.filter((i) => i.stockStatus === 'low').length,
      outOfStock: active.filter((i) => i.stockStatus === 'out').length,
    };
  }

  async valuationByCategory(): Promise<CategoryValuation[]> {
    const groups = new Map<number | null, CategoryValuation>();
    for (const item of this.active()) {
      const row = groups.get(item.categoryId) ?? {
        categoryId: item.categoryId,
        categoryName: item.categoryId === null ? null : (this.categories.store.get(item.categoryId)?.name ?? null),
        items: 0,
        units: 0,
        value: Money.zero(),
      };
      groups.set(item.categoryId, {
        ...row,
        items: row.items + 1,
        units: row.units + item.stock,
        value: row.value.add(item.stockValue),
      });
    }
    return [...groups.values()];
  }
}
