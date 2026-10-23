import { StreamableFile } from '@nestjs/common';
import { ExportReportUseCase } from '../../application/export-report.use-case.js';
import { GetAccountingDashboardUseCase } from '../../application/get-accounting-dashboard.use-case.js';
import { GetAuxiliaryLedgerUseCase } from '../../application/get-auxiliary-ledger.use-case.js';
import { GetBalanceSheetUseCase } from '../../application/get-balance-sheet.use-case.js';
import { GetGeneralJournalUseCase } from '../../application/get-general-journal.use-case.js';
import { GetGeneralLedgerUseCase } from '../../application/get-general-ledger.use-case.js';
import { GetIncomeStatementUseCase } from '../../application/get-income-statement.use-case.js';
import { GetTrialBalanceUseCase } from '../../application/get-trial-balance.use-case.js';
import { buildController } from '../../testing/controller-harness.js';
import { AccountingReportsController } from './accounting-reports.controller.js';
import { ExportReportQueryDto, GeneralJournalQueryDto } from './dto/report-query.dto.js';

describe('AccountingReportsController', () => {
  it('delegates each report to its use case', async () => {
    const { controller, mock } = await buildController(AccountingReportsController, [
      GetAccountingDashboardUseCase,
      GetTrialBalanceUseCase,
      GetGeneralJournalUseCase,
      GetGeneralLedgerUseCase,
      GetAuxiliaryLedgerUseCase,
      GetIncomeStatementUseCase,
      GetBalanceSheetUseCase,
      ExportReportUseCase,
    ]);
    const range = { from: '2026-03-01', to: '2026-03-31' };
    await controller.getDashboard({ month: '2026-03' });
    expect(mock(GetAccountingDashboardUseCase).execute).toHaveBeenCalledWith('2026-03');
    await controller.getTrialBalance({ ...range, level: 2 });
    expect(mock(GetTrialBalanceUseCase).execute).toHaveBeenCalledWith({ ...range, level: 2 });
    await controller.getJournal(Object.assign(new GeneralJournalQueryDto(), range));
    expect(mock(GetGeneralJournalUseCase).execute).toHaveBeenCalledWith({
      ...range,
      type: undefined,
      page: { page: 1, limit: 20 },
    });
    await controller.getLedger({ ...range, accountId: 3 });
    expect(mock(GetGeneralLedgerUseCase).execute).toHaveBeenCalledWith({ ...range, accountId: 3 });
    await controller.getAuxiliary({ ...range, accountId: 3 });
    expect(mock(GetAuxiliaryLedgerUseCase).execute).toHaveBeenCalledWith({ ...range, accountId: 3 });
    await controller.getIncomeStatement(range);
    expect(mock(GetIncomeStatementUseCase).execute).toHaveBeenCalledWith(range);
    await controller.getBalanceSheet({ asOf: '2026-03-31' });
    expect(mock(GetBalanceSheetUseCase).execute).toHaveBeenCalledWith('2026-03-31');
  });

  it('streams exported files as attachments', async () => {
    const { controller, mock } = await buildController(AccountingReportsController, [
      GetAccountingDashboardUseCase,
      GetTrialBalanceUseCase,
      GetGeneralJournalUseCase,
      GetGeneralLedgerUseCase,
      GetAuxiliaryLedgerUseCase,
      GetIncomeStatementUseCase,
      GetBalanceSheetUseCase,
      ExportReportUseCase,
    ]);
    mock(ExportReportUseCase).execute.mockResolvedValue({
      fileName: 'b.csv',
      contentType: 'text/csv',
      content: Buffer.from('x'),
    });
    const query = Object.assign(new ExportReportQueryDto(), { from: '2026-03-01', to: '2026-03-31' });
    const file = await controller.export('trial-balance', query);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({ type: 'text/csv', disposition: 'attachment; filename="b.csv"' });
    expect(mock(ExportReportUseCase).execute).toHaveBeenCalledWith(
      expect.objectContaining({ report: 'trial-balance', format: 'csv' }),
    );
  });
});
