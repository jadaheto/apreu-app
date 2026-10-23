import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { PostingRuleKeys } from '../domain/posting-rule.js';
import { AutomaticEntryPoster, type AutomaticPostingResult } from './automatic-entry-poster.js';
import type { ExpenseRegisteredPayload } from './integration-events.js';

/** Expense sources generated from payroll; those are booked from `hr.payroll-period-paid` instead. */
const PAYROLL_SOURCE = /payroll|n[oó]mina|^hr\b/i;

/**
 * Disbursement entry (CE) for `finance.expense-registered`:
 * D expense by category (`expense.debit.*`), C cash/bank/payable by source
 * (`expense.credit.*`). Payroll expenses are skipped to avoid booking payroll
 * twice (they are booked from the payroll event with the full breakdown).
 */
@Injectable()
export class PostExpenseEntryUseCase implements UseCase<ExpenseRegisteredPayload, AutomaticPostingResult> {
  constructor(private readonly poster: AutomaticEntryPoster) {}

  async execute(expense: ExpenseRegisteredPayload): Promise<AutomaticPostingResult> {
    if (PAYROLL_SOURCE.test(expense.source ?? '')) return { status: 'skipped', reason: 'PAYROLL_EXPENSE' };
    const amount = Money.of(expense.amount);
    const description = expense.description?.trim() || `Gasto #${expense.expenseId}`;
    return this.poster.post({
      source: { type: 'finance.expense', id: String(expense.expenseId) },
      date: expense.date,
      type: 'CE',
      description: description.slice(0, 255),
      lines: [
        { ruleKeys: PostingRuleKeys.expenseDebit(expense.categoryId ?? null), side: 'debit', amount, description },
        { ruleKeys: PostingRuleKeys.expenseCredit(expense.source ?? 'manual'), side: 'credit', amount, description },
      ],
    });
  }
}
