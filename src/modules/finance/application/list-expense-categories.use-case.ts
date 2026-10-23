import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { EXPENSE_CATEGORY_REPOSITORY, type ExpenseCategoryRepository } from '../domain/expense-category.repository.js';
import { toExpenseCategoryView, type ExpenseCategoryView } from './views.js';

/** Expense categories ordered by name. */
@Injectable()
export class ListExpenseCategoriesUseCase implements UseCase<void, ExpenseCategoryView[]> {
  constructor(@Inject(EXPENSE_CATEGORY_REPOSITORY) private readonly categories: ExpenseCategoryRepository) {}

  async execute(): Promise<ExpenseCategoryView[]> {
    return (await this.categories.list()).map(toExpenseCategoryView);
  }
}
