import { RecordingEventBus } from '../../shared/testing/fakes.js';
import type { IssueCertificatesOnPaymentUseCase } from './application/issue-certificates-on-payment.use-case.js';
import { PAYMENT_REGISTERED } from './application/integration-events.js';
import { StudentsModule } from './students.module.js';

describe('StudentsModule', () => {
  it('issues certificates when finance publishes a payment', async () => {
    const bus = new RecordingEventBus();
    const issue = { execute: vi.fn().mockResolvedValue(1) };
    new StudentsModule(bus, issue as unknown as IssueCertificatesOnPaymentUseCase).onModuleInit();

    const payload = { paymentId: 1, studentId: 2, appliedCharges: [] };
    await bus.publish({
      name: PAYMENT_REGISTERED,
      occurredAt: new Date(),
      payload,
    });

    expect(issue.execute).toHaveBeenCalledWith(payload);
  });
});
