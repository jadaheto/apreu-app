import { Module } from '@nestjs/common';
import { GetAdminDashboardUseCase } from './application/get-admin-dashboard.use-case.js';
import { ADMIN_DASHBOARD_QUERIES } from './domain/admin-dashboard-queries.port.js';
import { DashboardController } from './infrastructure/http/dashboard.controller.js';
import { SqlAdminDashboardQueries } from './infrastructure/persistence/sql-admin-dashboard-queries.js';

/** Dashboard context: read-only KPIs aggregated from the other contexts' tables. */
@Module({
  controllers: [DashboardController],
  providers: [GetAdminDashboardUseCase, { provide: ADMIN_DASHBOARD_QUERIES, useClass: SqlAdminDashboardQueries }],
})
export class DashboardModule {}
