import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetAgingReportUseCase } from '../../application/get-aging-report.use-case.js';
import { GetFinanceDashboardUseCase } from '../../application/get-finance-dashboard.use-case.js';
import { GetReconciliationUseCase } from '../../application/get-reconciliation.use-case.js';
import { FinanceMonthQueryDto } from './dto/payment.dto.js';
import { AgingQueryDto } from './dto/reports.dto.js';
import { FINANCE_STAFF } from './finance-roles.js';

@ApiTags('Finanzas · Reportes')
@ApiBearerAuth()
@Roles(...FINANCE_STAFF)
@Controller('finance')
export class FinanceReportsController {
  constructor(
    private readonly dashboard: GetFinanceDashboardUseCase,
    private readonly aging: GetAgingReportUseCase,
    private readonly reconciliation: GetReconciliationUseCase,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs financieros del mes' })
  getDashboard(@Query() query: FinanceMonthQueryDto) {
    return this.dashboard.execute({ month: query.month });
  }

  @Get('aging')
  @ApiOperation({ summary: 'Cartera vencida por deudor con nivel de riesgo' })
  getAging(@Query() query: AgingQueryDto) {
    return this.aging.execute({ risk: query.risk, gradeId: query.gradeId });
  }

  @Get('reconciliation')
  @ApiOperation({ summary: 'Pagos del mes para conciliación bancaria manual' })
  getReconciliation(@Query() query: FinanceMonthQueryDto) {
    return this.reconciliation.execute({ month: query.month });
  }
}
