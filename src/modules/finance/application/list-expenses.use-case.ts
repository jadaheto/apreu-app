import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { Calendar } from '../domain/calendar.js';
import { EXPENSE_CATEGORY_REPOSITORY, type ExpenseCategoryRepository } from '../domain/expense-category.repository.js';
import {
  EXPENSE_REPOSITORY,
  type ExpenseRepository,
  type ExpenseSearchCriteria,
} from '../domain/expense.repository.js';
import { toExpenseView, type ExpenseView } from './views.js';

/** Paginated expenses filtered by date range, category and text. */
@Injectable()
export class ListExpensesUseCase implements UseCase<
  { criteria: ExpenseSearchCriteria; page: PageRequest },
  Paginated<ExpenseView>
> {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository,
    @Inject(EXPENSE_CATEGORY_REPOSITORY) private readonly categories: ExpenseCategoryRepository,
  ) {}

  async execute({
    criteria,
    page,
  }: {
    criteria: ExpenseSearchCriteria;
    page: PageRequest;
  }): Promise<Paginated<ExpenseView>> {
    if (criteria.from) Calendar.assertDate(criteria.from, 'desde');
    if (criteria.to) Calendar.assertDate(criteria.to, 'hasta');
    const [result, categories] = await Promise.all([this.expenses.search(criteria, page), this.categories.list()]);
    const names = new Map(categories.map((category) => [category.id, category.name]));
    return mapPage(result, (expense) =>
      toExpenseView(expense, expense.categoryId === null ? null : (names.get(expense.categoryId) ?? null)),
    );
  }
}
