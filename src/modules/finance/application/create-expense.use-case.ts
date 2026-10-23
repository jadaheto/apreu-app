import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Calendar } from '../domain/calendar.js';
import { Expense } from '../domain/expense.js';
import { EXPENSE_CATEGORY_REPOSITORY, type ExpenseCategoryRepository } from '../domain/expense-category.repository.js';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from '../domain/expense.repository.js';
import { EXPENSE_REGISTERED, type ExpenseRegisteredPayload } from './integration-events.js';
import { toExpenseView, type ExpenseView } from './views.js';

export interface CreateExpenseInput {
  categoryId?: number | null;
  description: string;
  amount: number;
  /** Defaults to today. */
  date?: string;
  vendor?: string | null;
  receiptNo?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  actor: AuthenticatedActor;
}

/** Registers a manual expense (no CRUD existed in legacy) and publishes `finance.expense-registered`. */
@Injectable()
export class CreateExpenseUseCase implements UseCase<CreateExpenseInput, ExpenseView> {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository,
    @Inject(EXPENSE_CATEGORY_REPOSITORY) private readonly categories: ExpenseCategoryRepository,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, ...input }: CreateExpenseInput): Promise<ExpenseView> {
    const category = input.categoryId ? await this.categories.findById(input.categoryId) : null;
    if (input.categoryId && !category) throw new NotFoundError('Categoría de gasto', input.categoryId);

    const expense = Expense.create({
      ...input,
      categoryId: category?.id ?? null,
      date: input.date ?? Calendar.today(this.clock.now()),
      createdBy: actor.userId,
    });
    await this.expenses.save(expense);

    const payload: ExpenseRegisteredPayload = {
      expenseId: expense.id as number,
      categoryId: expense.categoryId,
      description: expense.description,
      amount: expense.amount.amount,
      date: expense.date,
      source: 'manual',
    };
    await this.events.publish({ name: EXPENSE_REGISTERED, occurredAt: this.clock.now(), payload: { ...payload } });
    return toExpenseView(expense, category?.name ?? null);
  }
}
