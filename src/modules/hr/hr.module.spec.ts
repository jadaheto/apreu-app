import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../shared/application/ports/clock.port.js';
import { EVENT_BUS } from '../../shared/application/ports/event-bus.port.js';
import { PASSWORD_HASHER } from '../../shared/application/ports/password-hasher.port.js';
import { UNIT_OF_WORK } from '../../shared/application/ports/unit-of-work.port.js';
import { DocumentBrandingProvider } from '../../shared/infrastructure/documents/document-branding.js';
import { TenantDataSource } from '../../shared/infrastructure/persistence/tenant-data-source.js';
import { TenantEntityRegistry } from '../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { FakePasswordHasher, FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../shared/testing/fakes.js';
import { CalculatePayrollPeriodUseCase } from './application/payroll/calculate-payroll-period.use-case.js';
import { RegisterEmployeeUseCase } from './application/employees/register-employee.use-case.js';
import { HrModule } from './hr.module.js';
import { EmployeeOrmEntity } from './infrastructure/persistence/employee.orm-entity.js';
import { PayrollParametersOrmEntity } from './infrastructure/persistence/payroll-parameters.orm-entity.js';

/** Stand-in for the global SharedModule (no database involved). */
@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: new FixedClock() },
    { provide: EVENT_BUS, useValue: new RecordingEventBus() },
    { provide: PASSWORD_HASHER, useValue: new FakePasswordHasher() },
    { provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork() },
    { provide: TenantDataSource, useValue: {} },
    { provide: DocumentBrandingProvider, useValue: {} },
  ],
  exports: [CLOCK, EVENT_BUS, PASSWORD_HASHER, UNIT_OF_WORK, TenantDataSource, DocumentBrandingProvider],
})
class FakeSharedModule {}

describe('HrModule', () => {
  it('resolves every provider and registers its ORM entities', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakeSharedModule, HrModule] }).compile();
    expect(moduleRef.get(RegisterEmployeeUseCase)).toBeInstanceOf(RegisterEmployeeUseCase);
    expect(moduleRef.get(CalculatePayrollPeriodUseCase)).toBeInstanceOf(CalculatePayrollPeriodUseCase);
    expect(TenantEntityRegistry.all()).toEqual(expect.arrayContaining([EmployeeOrmEntity, PayrollParametersOrmEntity]));
  });
});
