import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { ExpenseCategory } from '../domain/expense-category.js';
import { EXPENSE_CATEGORY_REPOSITORY, type ExpenseCategoryRepository } from '../domain/expense-category.repository.js';
import { toExpenseCategoryView, type ExpenseCategoryView } from './views.js';

export interface SaveExpenseCategoryInput {
  /** Omitted to create a new category; present to rename it. */
  id?: number;
  name: string;
}

/** Creates or renames an expense category; names are unique (case-insensitive). */
@Injectable()
export class SaveExpenseCategoryUseCase implements UseCase<SaveExpenseCategoryInput, ExpenseCategoryView> {
  constructor(@Inject(EXPENSE_CATEGORY_REPOSITORY) private readonly categories: ExpenseCategoryRepository) {}

  async execute({ id, name }: SaveExpenseCategoryInput): Promise<ExpenseCategoryView> {
    const homonym = await this.categories.findByName(name?.trim() ?? '');
    if (homonym && homonym.id !== id) {
      throw new ConflictError(`Ya existe la categoría de gasto "${homonym.name}".`, { categoryId: homonym.id });
    }
    let category: ExpenseCategory;
    if (id === undefined) {
      category = ExpenseCategory.create(name);
    } else {
      const found = await this.categories.findById(id);
      if (!found) throw new NotFoundError('Categoría de gasto', id);
      found.rename(name);
      category = found;
    }
    await this.categories.save(category);
    return toExpenseCategoryView(category);
  }
}
