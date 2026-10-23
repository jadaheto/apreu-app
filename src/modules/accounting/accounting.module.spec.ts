import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../shared/application/ports/clock.port.js';
import { EVENT_BUS } from '../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK } from '../../shared/application/ports/unit-of-work.port.js';
import { DocumentBrandingProvider } from '../../shared/infrastructure/documents/document-branding.js';
import { TenantDataSource } from '../../shared/infrastructure/persistence/tenant-data-source.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../shared/testing/fakes.js';
import { AccountingModule } from './accounting.module.js';
import { AccountingReportsController } from './infrastructure/http/accounting-reports.controller.js';
import { JournalEntriesController } from './infrastructure/http/journal-entries.controller.js';

describe('AccountingModule', () => {
  it('resolves every provider and subscribes to the integration events on init', async () => {
    const bus = new RecordingEventBus();
    const subscribe = vi.spyOn(bus, 'subscribe');

    @Global()
    @Module({
      providers: [
        { provide: TenantDataSource, useValue: {} },
        { provide: CLOCK, useValue: new FixedClock() },
        { provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork() },
        { provide: EVENT_BUS, useValue: bus },
        { provide: DocumentBrandingProvider, useValue: {} },
      ],
      exports: [TenantDataSource, CLOCK, UNIT_OF_WORK, EVENT_BUS, DocumentBrandingProvider],
    })
    class FakeSharedModule {}

    const moduleRef = await Test.createTestingModule({ imports: [FakeSharedModule, AccountingModule] }).compile();
    await moduleRef.init();

    expect(moduleRef.get(JournalEntriesController)).toBeDefined();
    expect(moduleRef.get(AccountingReportsController)).toBeDefined();
    expect(subscribe.mock.calls.map(([name]) => name)).toEqual([
      'finance.payment-registered',
      'finance.payment-voided',
      'finance.expense-registered',
      'hr.payroll-period-paid',
    ]);
    await moduleRef.close();
  });
});
