import { RecordingEventBus } from '../../../../shared/testing/fakes.js';
import { CommunicationSettings } from '../../application/services/communication-settings.js';
import { configuredSettings, InMemorySettingsStore } from '../../testing/fakes.js';
import {
  BULLETINS_GENERATED,
  CommunicationsEventSubscriber,
  INVOICE_ACCEPTED,
} from './communications-event.subscriber.js';

describe('CommunicationsEventSubscriber', () => {
  const invoicePayload = { dianInvoiceId: 4, number: 'SETP4', cufe: 'c', paymentId: null, total: 1000 };
  let bus: RecordingEventBus;
  let sendInvoice: { execute: ReturnType<typeof vi.fn> };
  let bulletins: { execute: ReturnType<typeof vi.fn> };

  const subscribe = (settings: CommunicationSettings) => {
    new CommunicationsEventSubscriber(bus, settings, sendInvoice as never, bulletins as never).register();
  };
  const publish = (name: string, payload: unknown) => bus.publish({ name, occurredAt: new Date(), payload });

  beforeEach(() => {
    bus = new RecordingEventBus();
    sendInvoice = { execute: vi.fn().mockResolvedValue({}) };
    bulletins = { execute: vi.fn().mockResolvedValue({}) };
  });

  it('e-mails accepted invoices when SMTP is configured', async () => {
    subscribe(new CommunicationSettings(configuredSettings()));
    await publish(INVOICE_ACCEPTED, invoicePayload);
    expect(sendInvoice.execute).toHaveBeenCalledWith({ dianInvoiceId: 4, userId: null });
  });

  it('skips the invoice e-mail without SMTP configuration', async () => {
    subscribe(new CommunicationSettings(new InMemorySettingsStore()));
    await publish(INVOICE_ACCEPTED, invoicePayload);
    expect(sendInvoice.execute).not.toHaveBeenCalled();
  });

  it('never propagates failures to the publisher', async () => {
    sendInvoice.execute.mockRejectedValue(new Error('El cliente no tiene email configurado.'));
    bulletins.execute.mockRejectedValue(new Error('BD caída'));
    subscribe(new CommunicationSettings(configuredSettings()));
    await expect(publish(INVOICE_ACCEPTED, invoicePayload)).resolves.toBeUndefined();
    await expect(publish(BULLETINS_GENERATED, { periodId: 1, studentIds: [1] })).resolves.toBeUndefined();
  });

  it('notifies generated bulletins', async () => {
    subscribe(new CommunicationSettings(configuredSettings()));
    await publish(BULLETINS_GENERATED, { periodId: 3, studentIds: [5, 6] });
    expect(bulletins.execute).toHaveBeenCalledWith({ periodId: 3, studentIds: [5, 6] });
  });
});
