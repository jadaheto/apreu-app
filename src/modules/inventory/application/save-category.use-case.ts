import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { InventoryCategory } from '../domain/inventory-category.js';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  type InventoryCategoryRepository,
} from '../domain/inventory-category.repository.js';
import { toCategoryView, type InventoryCategoryView } from './inventory-views.js';

export interface SaveCategoryInput {
  /** Omitted to create, present to rename. */
  id?: number;
  name: string;
}

/** Creates or renames a category keeping names unique (case-insensitive). */
@Injectable()
export class SaveCategoryUseCase implements UseCase<SaveCategoryInput, InventoryCategoryView> {
  constructor(@Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository) {}

  async execute({ id, name }: SaveCategoryInput): Promise<InventoryCategoryView> {
    let category: InventoryCategory;
    if (id === undefined) {
      category = InventoryCategory.create(name);
    } else {
      const existing = await this.categories.findById(id);
      if (!existing) throw new NotFoundError('Categoría de inventario', id);
      existing.rename(name);
      category = existing;
    }
    const homonym = await this.categories.findByName(category.name);
    if (homonym && homonym.id !== category.id) {
      throw new ConflictError(`Ya existe la categoría "${category.name}".`);
    }
    await this.categories.save(category);
    return toCategoryView(category);
  }
}
