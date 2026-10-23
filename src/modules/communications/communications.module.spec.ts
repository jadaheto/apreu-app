import { Test } from '@nestjs/testing';
import { RecordingEventBus } from '../../shared/testing/fakes.js';
import { createKernelStubModule } from '../../shared/testing/kernel-stub.module.js';
import { CommunicationsModule } from './communications.module.js';
import { EmailController } from './infrastructure/http/email.controller.js';
import { BULLETINS_GENERATED, INVOICE_ACCEPTED } from './infrastructure/events/communications-event.subscriber.js';

const bus = new RecordingEventBus();

const FakeSharedModule = createKernelStubModule(bus);

describe('CommunicationsModule', () => {
  it('resolves every provider and subscribes to integration events', async () => {
    const subscribe = vi.spyOn(bus, 'subscribe');
    const moduleRef = await Test.createTestingModule({ imports: [FakeSharedModule, CommunicationsModule] }).compile();
    await moduleRef.init();

    expect(moduleRef.get(EmailController)).toBeInstanceOf(EmailController);
    expect(subscribe.mock.calls.map(([name]) => name)).toEqual([INVOICE_ACCEPTED, BULLETINS_GENERATED]);
    await moduleRef.close();
  });
});
