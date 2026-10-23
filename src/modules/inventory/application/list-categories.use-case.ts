import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  type InventoryCategoryRepository,
} from '../domain/inventory-category.repository.js';
import { toCategoryView, type InventoryCategoryView } from './inventory-views.js';

/** Inventory categories ordered by name. */
@Injectable()
export class ListCategoriesUseCase implements UseCase<void, InventoryCategoryView[]> {
  constructor(@Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository) {}

  async execute(): Promise<InventoryCategoryView[]> {
    return (await this.categories.findAll()).map(toCategoryView);
  }
}
