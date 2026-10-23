import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcademicModule } from './modules/academic/academic.module.js';
import { AccountingModule } from './modules/accounting/accounting.module.js';
import { CommunicationsModule } from './modules/communications/communications.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { EInvoicingModule } from './modules/e-invoicing/e-invoicing.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { HrModule } from './modules/hr/hr.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { InstitutionModule } from './modules/institution/institution.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { SharedModule } from './shared/infrastructure/shared.module.js';

/** Composition root: one module per bounded context (see docs/adr/0002-arquitectura-hexagonal.md). */
@Module({
  imports: [
    SharedModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    IdentityModule,
    InstitutionModule,
    DashboardModule,
    AcademicModule,
    StudentsModule,
    FinanceModule,
    EInvoicingModule,
    AccountingModule,
    InventoryModule,
    HrModule,
    CommunicationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
