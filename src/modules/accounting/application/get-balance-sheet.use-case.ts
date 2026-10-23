import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { Ledger } from '../domain/ledger.js';
import { LedgerReader, toAmount } from './ledger-reader.js';
import type { BalanceSheetView } from './report-views.js';
import { statementSection } from './statement-section.js';

/**
 * Balance sheet at a cut-off date (missing in the legacy), cumulative since
 * the beginning: Activo = Σ(D−C) class 1; Pasivo = Σ(C−D) class 2;
 * Patrimonio = Σ(C−D) class 3 + result of the year not yet closed.
 * Control: Activo = Pasivo + Patrimonio.
 */
@Injectable()
export class GetBalanceSheetUseCase implements UseCase<string, BalanceSheetView> {
  constructor(private readonly reader: LedgerReader) {}

  async execute(asOfInput: string): Promise<BalanceSheetView> {
    const asOf = CalendarDay.parse(asOfInput, 'fecha de corte');
    const rows = await this.reader.rows({ to: asOf });
    const assets = statementSection(rows, ['activo']);
    const liabilities = statementSection(rows, ['pasivo']);
    const equity = statementSection(rows, ['patrimonio']);
    const resultCents =
      Ledger.totalByTypes(rows, ['ingreso']) -
      Ledger.totalByTypes(rows, ['costo']) -
      Ledger.totalByTypes(rows, ['gasto']);
    const totalEquityCents = Ledger.totalByTypes(rows, ['patrimonio']) + resultCents;
    const liabilitiesAndEquityCents = Ledger.totalByTypes(rows, ['pasivo']) + totalEquityCents;
    return {
      asOf,
      assets,
      liabilities,
      equity,
      periodResult: toAmount(resultCents),
      totalEquity: toAmount(totalEquityCents),
      totalLiabilitiesAndEquity: toAmount(liabilitiesAndEquityCents),
      balanced: Ledger.totalByTypes(rows, ['activo']) === liabilitiesAndEquityCents,
    };
  }
}
