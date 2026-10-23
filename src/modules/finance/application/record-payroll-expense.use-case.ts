import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Calendar } from '../domain/calendar.js';
import { Expense } from '../domain/expense.js';
import { ExpenseCategory } from '../domain/expense-category.js';
import { EXPENSE_CATEGORY_REPOSITORY, type ExpenseCategoryRepository } from '../domain/expense-category.repository.js';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from '../domain/expense.repository.js';
import {
  EXPENSE_REGISTERED,
  type ExpenseRegisteredPayload,
  type PayrollPeriodPaidPayload,
} from './integration-events.js';

/** Idempotency key stored in `expenses.receipt_no`. */
export const payrollExpenseKey = (periodId: number): string => `NOMINA-${periodId}`;

/**
 * Handler of `hr.payroll-period-paid` (legacy `hr/payroll.php:31-48`): records
 * the net payroll as an expense of the category "Pago de Nómina y SS"
 * (created when missing), paid by transfer to "Empleados". Idempotent per
 * period, so a re-delivered event never duplicates the expense.
 */
@Injectable()
export class RecordPayrollExpenseUseCase implements UseCase<PayrollPeriodPaidPayload, ExpenseRegisteredPayload | null> {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository,
    @Inject(EXPENSE_CATEGORY_REPOSITORY) private readonly categories: ExpenseCategoryRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(period: PayrollPeriodPaidPayload): Promise<ExpenseRegisteredPayload | null> {
    if (!(period.netTotal > 0)) return null;
    const key = payrollExpenseKey(period.periodId);

    const expense = await this.uow.runInTransaction(async () => {
      if (await this.expenses.existsByReceiptNo(key)) return null;
      let category = await this.categories.findByName(ExpenseCategory.PAYROLL_NAME);
      if (!category) {
        category = ExpenseCategory.create(ExpenseCategory.PAYROLL_NAME);
        await this.categories.save(category);
      }
      const created = Expense.create({
        categoryId: category.id,
        description: `Liquidación ${period.periodName}`.slice(0, 255),
        amount: period.netTotal,
        date: Calendar.today(this.clock.now()),
        vendor: 'Empleados',
        receiptNo: key,
        paymentMethod: 'transferencia',
        notes: `Período ${period.startDate} a ${period.endDate}. Devengado ${period.grossTotal}, deducciones ${period.deductionsTotal}.`,
        createdBy: null,
      });
      await this.expenses.save(created);
      return created;
    });
    if (!expense) return null;

    const payload: ExpenseRegisteredPayload = {
      expenseId: expense.id as number,
      categoryId: expense.categoryId,
      description: expense.description,
      amount: expense.amount.amount,
      date: expense.date,
      source: 'payroll',
    };
    await this.events.publish({ name: EXPENSE_REGISTERED, occurredAt: this.clock.now(), payload: { ...payload } });
    return payload;
  }
}
