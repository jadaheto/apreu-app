import { GetAgingReportUseCase } from '../../application/get-aging-report.use-case.js';
import { GetFinanceDashboardUseCase } from '../../application/get-finance-dashboard.use-case.js';
import { GetReconciliationUseCase } from '../../application/get-reconciliation.use-case.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { FinanceReportsController } from './finance-reports.controller.js';

describe('FinanceReportsController', () => {
  it('delegates dashboard, aging and reconciliation', async () => {
    const { controller, mock } = await controllerWithMocks(FinanceReportsController, [
      GetFinanceDashboardUseCase,
      GetAgingReportUseCase,
      GetReconciliationUseCase,
    ]);
    await controller.getDashboard({ month: '2026-03' });
    await controller.getAging({ risk: 'alto', gradeId: 2 });
    await controller.getReconciliation({});
    expect(mock(GetFinanceDashboardUseCase)).toHaveBeenCalledWith({ month: '2026-03' });
    expect(mock(GetAgingReportUseCase)).toHaveBeenCalledWith({ risk: 'alto', gradeId: 2 });
    expect(mock(GetReconciliationUseCase)).toHaveBeenCalledWith({ month: undefined });
  });
});
