import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { LedgerReader, parseRange } from './ledger-reader.js';
import type { IncomeStatementView } from './report-views.js';
import { statementSection } from './statement-section.js';

export interface GetIncomeStatementInput {
  from: string;
  to: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Income statement (P&G) for the movements of the range. Fixes bug 3 (the
 * legacy read non-existent keys and always showed 0) and includes costs
 * (class 6/7), which the legacy ignored: gross profit = income − costs,
 * net income = income − costs − expenses.
 */
@Injectable()
export class GetIncomeStatementUseCase implements UseCase<GetIncomeStatementInput, IncomeStatementView> {
  constructor(private readonly reader: LedgerReader) {}

  async execute(input: GetIncomeStatementInput): Promise<IncomeStatementView> {
    const { from, to } = parseRange(input.from, input.to);
    // Only the movements of the range count: the opening balance is excluded.
    const rows = await this.reader.rows({ from, to, withOpening: false });
    const income = statementSection(rows, ['ingreso']);
    const costs = statementSection(rows, ['costo']);
    const expenses = statementSection(rows, ['gasto']);
    return {
      from,
      to,
      income,
      costs,
      expenses,
      grossProfit: round2(income.total - costs.total),
      netIncome: round2(income.total - costs.total - expenses.total),
    };
  }
}
