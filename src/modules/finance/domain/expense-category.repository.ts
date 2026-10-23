import type { ExpenseCategory } from './expense-category.js';

/** Output port for {@link ExpenseCategory} persistence. */
export interface ExpenseCategoryRepository {
  findById(id: number): Promise<ExpenseCategory | null>;
  /** Case-insensitive lookup by name. */
  findByName(name: string): Promise<ExpenseCategory | null>;
  list(): Promise<ExpenseCategory[]>;
  save(category: ExpenseCategory): Promise<void>;
}

export const EXPENSE_CATEGORY_REPOSITORY = Symbol('ExpenseCategoryRepository');
