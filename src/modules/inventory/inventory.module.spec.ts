import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../shared/application/ports/clock.port.js';
import { EVENT_BUS } from '../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK } from '../../shared/application/ports/unit-of-work.port.js';
import { TenantDataSource } from '../../shared/infrastructure/persistence/tenant-data-source.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../shared/testing/fakes.js';
import { InventoryItemsController } from './infrastructure/http/inventory-items.controller.js';
import { InventoryModule } from './inventory.module.js';

describe('InventoryModule', () => {
  it('resolves every provider', async () => {
    @Global()
    @Module({
      providers: [
        { provide: TenantDataSource, useValue: {} },
        { provide: CLOCK, useValue: new FixedClock() },
        { provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork() },
        { provide: EVENT_BUS, useValue: new RecordingEventBus() },
      ],
      exports: [TenantDataSource, CLOCK, UNIT_OF_WORK, EVENT_BUS],
    })
    class FakeSharedModule {}

    const moduleRef = await Test.createTestingModule({ imports: [FakeSharedModule, InventoryModule] }).compile();
    expect(moduleRef.get(InventoryItemsController)).toBeDefined();
    await moduleRef.close();
  });
});
