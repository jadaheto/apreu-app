import { Inject, Injectable } from '@nestjs/common';
import type { InventoryItem } from '../domain/inventory-item.js';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  type InventoryCategoryRepository,
} from '../domain/inventory-category.repository.js';
import { toItemView, type InventoryItemView } from './inventory-views.js';

/** Renders items with their category names. */
@Injectable()
export class ItemPresenter {
  constructor(@Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository) {}

  async present(items: readonly InventoryItem[]): Promise<InventoryItemView[]> {
    const ids = [...new Set(items.map((item) => item.categoryId).filter((id): id is number => id !== null))];
    const names = new Map((ids.length ? await this.categories.findByIds(ids) : []).map((c) => [c.id, c.name]));
    return items.map((item) =>
      toItemView(item, item.categoryId === null ? null : (names.get(item.categoryId) ?? null)),
    );
  }

  async presentOne(item: InventoryItem): Promise<InventoryItemView> {
    return (await this.present([item]))[0];
  }
}
