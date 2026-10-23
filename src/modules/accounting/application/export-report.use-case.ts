import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import type { AccountLevel } from '../domain/account-code.js';
import type { VoucherType } from '../domain/voucher-type.js';
import { GetAuxiliaryLedgerUseCase } from './get-auxiliary-ledger.use-case.js';
import { GetBalanceSheetUseCase } from './get-balance-sheet.use-case.js';
import { GetGeneralJournalUseCase } from './get-general-journal.use-case.js';
import { GetGeneralLedgerUseCase } from './get-general-ledger.use-case.js';
import { GetIncomeStatementUseCase } from './get-income-statement.use-case.js';
import { GetTrialBalanceUseCase } from './get-trial-balance.use-case.js';
import {
  REPORT_RENDERER,
  type RenderedReport,
  type ReportFormat,
  type ReportRendererPort,
  type ReportTable,
} from './ports/report-renderer.port.js';
import type { AuxiliaryLineView, StatementSectionView } from './report-views.js';

export const EXPORTABLE_REPORTS = [
  'trial-balance',
  'journal',
  'ledger',
  'auxiliary',
  'income-statement',
  'balance-sheet',
] as const;
export type ExportableReport = (typeof EXPORTABLE_REPORTS)[number];

export interface ExportReportInput {
  report: ExportableReport;
  format: ReportFormat;
  from?: string;
  to?: string;
  asOf?: string;
  level?: AccountLevel;
  accountId?: number;
  thirdPartyId?: number;
  type?: VoucherType;
}

/** The journal export includes the whole range in one file. */
const JOURNAL_EXPORT_LIMIT = 10_000;

const auxiliaryRows = (lines: AuxiliaryLineView[]) =>
  lines.map((l) => [
    l.date,
    l.voucher,
    l.entryDescription,
    l.thirdPartyName,
    l.description,
    l.debit,
    l.credit,
    l.balance,
  ]);

const sectionRows = (title: string, section: StatementSectionView) => [
  ...section.rows.map((row) => [title, row.code, row.name, row.amount]),
  [title, null, `Total ${title.toLowerCase()}`, section.total],
];

/**
 * Exports an accounting report (the legacy only offered `window.print()`).
 * Builds a format-independent table from the report use case and delegates
 * rendering to {@link ReportRendererPort}.
 */
@Injectable()
export class ExportReportUseCase implements UseCase<ExportReportInput, RenderedReport> {
  constructor(
    private readonly trialBalance: GetTrialBalanceUseCase,
    private readonly journal: GetGeneralJournalUseCase,
    private readonly ledger: GetGeneralLedgerUseCase,
    private readonly auxiliary: GetAuxiliaryLedgerUseCase,
    private readonly incomeStatement: GetIncomeStatementUseCase,
    private readonly balanceSheet: GetBalanceSheetUseCase,
    @Inject(REPORT_RENDERER) private readonly renderer: ReportRendererPort,
  ) {}

  async execute(input: ExportReportInput): Promise<RenderedReport> {
    return this.renderer.render(await this.buildTable(input), input.format);
  }

  private async buildTable(input: ExportReportInput): Promise<ReportTable> {
    if (input.report === 'balance-sheet') {
      const sheet = await this.balanceSheet.execute(this.required(input.asOf, 'asOf'));
      return {
        title: `Balance general a ${sheet.asOf}`,
        slug: `balance-general-${sheet.asOf}`,
        columns: ['Sección', 'Código', 'Cuenta', 'Valor'],
        rows: [
          ...sectionRows('Activo', sheet.assets),
          ...sectionRows('Pasivo', sheet.liabilities),
          ...sectionRows('Patrimonio', sheet.equity),
          ['Patrimonio', null, 'Resultado del ejercicio', sheet.periodResult],
          [null, null, 'Total pasivo + patrimonio', sheet.totalLiabilitiesAndEquity],
        ],
      };
    }
    const from = this.required(input.from, 'from');
    const to = this.required(input.to, 'to');
    const suffix = `${from}_${to}`;
    switch (input.report) {
      case 'trial-balance': {
        const report = await this.trialBalance.execute({ from, to, level: input.level });
        return {
          title: `Balance de prueba ${from} a ${to}`,
          slug: `balance-de-prueba-${suffix}`,
          columns: ['Código', 'Cuenta', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo débito', 'Saldo crédito'],
          rows: [
            ...report.rows.map((r) => [
              r.code,
              r.name,
              r.openingBalance,
              r.debit,
              r.credit,
              r.debitBalance,
              r.creditBalance,
            ]),
            [
              null,
              'TOTALES',
              null,
              report.totals.debit,
              report.totals.credit,
              report.totals.debitBalance,
              report.totals.creditBalance,
            ],
          ],
        };
      }
      case 'journal': {
        const report = await this.journal.execute({
          from,
          to,
          type: input.type,
          page: { page: 1, limit: JOURNAL_EXPORT_LIMIT },
        });
        return {
          title: `Libro diario ${from} a ${to}`,
          slug: `libro-diario-${suffix}`,
          columns: ['Fecha', 'Comprobante', 'Descripción', 'Cuenta', 'Tercero', 'Detalle', 'Débito', 'Crédito'],
          rows: [
            ...report.entries.items.flatMap((entry) =>
              (entry.lines ?? []).map((line) => [
                entry.date,
                entry.displayNumber,
                entry.description,
                `${line.accountCode ?? ''} ${line.accountName ?? ''}`.trim(),
                line.thirdPartyName,
                line.description,
                line.debit,
                line.credit,
              ]),
            ),
            [null, null, 'TOTALES', null, null, null, report.totals.debit, report.totals.credit],
          ],
        };
      }
      case 'ledger': {
        const report = await this.ledger.execute({ from, to, accountId: input.accountId });
        return {
          title: `Libro mayor ${from} a ${to}`,
          slug: `libro-mayor-${suffix}`,
          columns: ['Código', 'Cuenta', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo final'],
          rows: report.rows.map((r) => [r.code, r.name, r.openingBalance, r.debit, r.credit, r.closingBalance]),
        };
      }
      case 'auxiliary': {
        const accountId = Number(this.required(input.accountId, 'accountId'));
        const report = await this.auxiliary.execute({ from, to, accountId, thirdPartyId: input.thirdPartyId });
        return {
          title: `Libro auxiliar ${report.account.code} ${report.account.name} ${from} a ${to}`,
          slug: `libro-auxiliar-${report.account.code}-${suffix}`,
          columns: ['Fecha', 'Comprobante', 'Descripción', 'Tercero', 'Detalle', 'Débito', 'Crédito', 'Saldo'],
          rows: [
            [null, null, 'Saldo inicial', null, null, null, null, report.openingBalance],
            ...auxiliaryRows(report.lines),
            [null, null, 'Saldo final', null, null, report.totals.debit, report.totals.credit, report.closingBalance],
          ],
        };
      }
      case 'income-statement': {
        const report = await this.incomeStatement.execute({ from, to });
        return {
          title: `Estado de resultados ${from} a ${to}`,
          slug: `estado-de-resultados-${suffix}`,
          columns: ['Sección', 'Código', 'Cuenta', 'Valor'],
          rows: [
            ...sectionRows('Ingresos', report.income),
            ...sectionRows('Costos', report.costs),
            [null, null, 'Utilidad bruta', report.grossProfit],
            ...sectionRows('Gastos', report.expenses),
            [null, null, 'Utilidad neta', report.netIncome],
          ],
        };
      }
    }
  }

  private required<T>(value: T | undefined, field: string): T {
    if (value === undefined || value === null || value === '') {
      throw new BusinessRuleViolationError(
        `El parámetro "${field}" es obligatorio para este reporte.`,
        'REQUIRED_FIELD',
        {
          field,
        },
      );
    }
    return value;
  }
}
