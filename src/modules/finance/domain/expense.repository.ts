import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { Expense } from './expense.js';

export interface ExpenseSearchCriteria {
  /** Inclusive `YYYY-MM-DD` bounds. */
  from?: string;
  to?: string;
  categoryId?: number;
  search?: string;
}

/** Output port for {@link Expense} persistence. */
export interface ExpenseRepository {
  findById(id: number): Promise<Expense | null>;
  /** Used as idempotency key (e.g. `NOMINA-{periodId}`). */
  existsByReceiptNo(receiptNo: string): Promise<boolean>;
  /** Most recent first. */
  search(criteria: ExpenseSearchCriteria, page: PageRequest): Promise<Paginated<Expense>>;
  save(expense: Expense): Promise<void>;
}

export const EXPENSE_REPOSITORY = Symbol('ExpenseRepository');
