import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../shared/application/ports/clock.port.js';
import { EVENT_BUS } from '../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK } from '../../shared/application/ports/unit-of-work.port.js';
import { TenantDataSource } from '../../shared/infrastructure/persistence/tenant-data-source.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../shared/testing/fakes.js';
import { RegisterPaymentUseCase } from './application/register-payment.use-case.js';
import { FinanceModule } from './finance.module.js';

const bus = new RecordingEventBus();

@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: new FixedClock() },
    { provide: EVENT_BUS, useValue: bus },
    { provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork() },
    { provide: TenantDataSource, useValue: {} },
  ],
  exports: [CLOCK, EVENT_BUS, UNIT_OF_WORK, TenantDataSource],
})
class KernelStubModule {}

describe('FinanceModule', () => {
  it('resolves every provider and subscribes to hr.payroll-period-paid', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [KernelStubModule, FinanceModule] }).compile();
    await moduleRef.init();
    expect(moduleRef.get(RegisterPaymentUseCase)).toBeInstanceOf(RegisterPaymentUseCase);
    expect(
      (bus as unknown as { handlers: Map<string, unknown[]> }).handlers.get('hr.payroll-period-paid'),
    ).toHaveLength(1);
    await moduleRef.close();
  });
});
