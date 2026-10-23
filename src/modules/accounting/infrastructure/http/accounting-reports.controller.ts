import { Controller, Get, Param, ParseEnumPipe, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import {
  EXPORTABLE_REPORTS,
  ExportReportUseCase,
  type ExportableReport,
} from '../../application/export-report.use-case.js';
import { GetAccountingDashboardUseCase } from '../../application/get-accounting-dashboard.use-case.js';
import { GetAuxiliaryLedgerUseCase } from '../../application/get-auxiliary-ledger.use-case.js';
import { GetBalanceSheetUseCase } from '../../application/get-balance-sheet.use-case.js';
import { GetGeneralJournalUseCase } from '../../application/get-general-journal.use-case.js';
import { GetGeneralLedgerUseCase } from '../../application/get-general-ledger.use-case.js';
import { GetIncomeStatementUseCase } from '../../application/get-income-statement.use-case.js';
import { GetTrialBalanceUseCase } from '../../application/get-trial-balance.use-case.js';
import { ACCOUNTING_ROLES } from './accounting-roles.js';
import {
  AuxiliaryLedgerQueryDto,
  BalanceSheetQueryDto,
  DashboardQueryDto,
  AccountingDateRangeQueryDto,
  ExportReportQueryDto,
  GeneralJournalQueryDto,
  GeneralLedgerQueryDto,
  TrialBalanceQueryDto,
} from './dto/report-query.dto.js';

const reportEnum = Object.fromEntries(EXPORTABLE_REPORTS.map((report) => [report, report]));

@ApiTags('Contabilidad - Reportes')
@ApiBearerAuth()
@Roles(...ACCOUNTING_ROLES)
@Controller('accounting')
export class AccountingReportsController {
  constructor(
    private readonly dashboard: GetAccountingDashboardUseCase,
    private readonly trialBalance: GetTrialBalanceUseCase,
    private readonly journal: GetGeneralJournalUseCase,
    private readonly ledger: GetGeneralLedgerUseCase,
    private readonly auxiliary: GetAuxiliaryLedgerUseCase,
    private readonly incomeStatement: GetIncomeStatementUseCase,
    private readonly balanceSheet: GetBalanceSheetUseCase,
    private readonly exportReport: ExportReportUseCase,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs del mes, últimos asientos y periodo actual' })
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.dashboard.execute(query.month);
  }

  @Get('reports/trial-balance')
  @ApiOperation({ summary: 'Balance de prueba' })
  getTrialBalance(@Query() query: TrialBalanceQueryDto) {
    return this.trialBalance.execute(query);
  }

  @Get('reports/journal')
  @ApiOperation({ summary: 'Libro diario' })
  getJournal(@Query() query: GeneralJournalQueryDto) {
    return this.journal.execute({ from: query.from, to: query.to, type: query.type, page: query.toPageRequest() });
  }

  @Get('reports/ledger')
  @ApiOperation({ summary: 'Libro mayor' })
  getLedger(@Query() query: GeneralLedgerQueryDto) {
    return this.ledger.execute(query);
  }

  @Get('reports/auxiliary')
  @ApiOperation({ summary: 'Libro auxiliar por cuenta (y tercero)' })
  getAuxiliary(@Query() query: AuxiliaryLedgerQueryDto) {
    return this.auxiliary.execute(query);
  }

  @Get('reports/income-statement')
  @ApiOperation({ summary: 'Estado de resultados' })
  getIncomeStatement(@Query() query: AccountingDateRangeQueryDto) {
    return this.incomeStatement.execute(query);
  }

  @Get('reports/balance-sheet')
  @ApiOperation({ summary: 'Balance general a una fecha de corte' })
  getBalanceSheet(@Query() query: BalanceSheetQueryDto) {
    return this.balanceSheet.execute(query.asOf);
  }

  @Get('reports/:report/export')
  @ApiParam({ name: 'report', enum: EXPORTABLE_REPORTS })
  @ApiOperation({ summary: 'Exporta un reporte en CSV, XLSX (Excel) o PDF con membrete del colegio' })
  async export(
    @Param('report', new ParseEnumPipe(reportEnum)) report: ExportableReport,
    @Query() query: ExportReportQueryDto,
  ): Promise<StreamableFile> {
    const file = await this.exportReport.execute({ report, ...query });
    return new StreamableFile(file.content, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }
}
