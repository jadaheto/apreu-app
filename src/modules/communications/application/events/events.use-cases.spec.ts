import { ExternalServiceError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { FixedClock, RecordingEventBus } from '../../../../shared/testing/fakes.js';
import { FakeDirectory } from '../../testing/fake-directory.js';
import {
  configuredSettings,
  FakeEmailSender,
  InMemoryFileStorage,
  InMemorySettingsStore,
  InstantDelay,
  PNG_BYTES,
} from '../../testing/fakes.js';
import { InMemoryEmailLogRepository, InMemoryNotificationRepository } from '../../testing/in-memory-repositories.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import { NotifyBulletinsGeneratedUseCase } from './notify-bulletins-generated.use-case.js';
import { INVOICE_EMAIL_SENT, SendInvoiceEmailUseCase } from './send-invoice-email.use-case.js';

describe('event-driven use cases', () => {
  let directory: FakeDirectory;
  let sender: FakeEmailSender;
  let logs: InMemoryEmailLogRepository;
  let settings: CommunicationSettings;
  const clock = new FixedClock();

  beforeEach(() => {
    directory = new FakeDirectory();
    sender = new FakeEmailSender();
    logs = new InMemoryEmailLogRepository();
    settings = new CommunicationSettings(
      configuredSettings({
        email_logo_path: 'email/email_logo.png',
        email_promo_path: 'email/no-existe.png',
        dian_business_name: 'Colegio SAS',
      }),
    );
  });

  describe('SendInvoiceEmailUseCase', () => {
    let storage: InMemoryFileStorage;
    let bus: RecordingEventBus;
    const invoice = {
      id: 4,
      number: 'SETP990000004',
      cufe: 'abc',
      customerName: 'Luis Pérez',
      customerEmail: 'Luis@Mail.co',
      total: 350000,
      issueDate: '2026-03-15',
      xmlContent: '<Invoice/>',
    };

    beforeEach(async () => {
      storage = new InMemoryFileStorage();
      await storage.save('email/email_logo.png', PNG_BYTES);
      bus = new RecordingEventBus();
      directory.invoices = [invoice];
    });

    const send = (dianInvoiceId = 4) =>
      new SendInvoiceEmailUseCase(
        directory,
        storage,
        bus,
        clock,
        settings,
        new EmailDelivery(sender, logs, clock),
      ).execute({
        dianInvoiceId,
        userId: null,
      });

    it('sends the XML with the inline logo, logs it and publishes the event', async () => {
      await expect(send()).resolves.toEqual({ to: 'luis@mail.co', number: 'SETP990000004' });

      const { message } = sender.sent[0];
      expect(message.subject).toBe('Factura Electrónica SETP990000004 - Colegio SAS');
      expect(message.attachments.map((a) => [a.filename, a.contentId ?? null])).toEqual([
        ['logo.png', 'logo@apreu'],
        ['SETP990000004.xml', null],
      ]);
      expect(message.html).toContain('cid:logo@apreu');
      expect(logs.store.all()[0]).toMatchObject({ type: 'factura_dian', status: 'sent' });
      expect(bus.published).toEqual([
        expect.objectContaining({
          name: INVOICE_EMAIL_SENT,
          payload: { dianInvoiceId: 4, number: 'SETP990000004', to: 'luis@mail.co', sentAt: clock.now().toISOString() },
        }),
      ]);
    });

    it('fails for unknown invoices, buyers without e-mail and provider errors', async () => {
      await expect(send(99)).rejects.toBeInstanceOf(NotFoundError);
      directory.invoices = [{ ...invoice, customerEmail: null }];
      await expect(send()).rejects.toMatchObject({ code: 'CUSTOMER_WITHOUT_EMAIL' });
      directory.invoices = [invoice];
      sender.failFor.add('luis@mail.co');
      await expect(send()).rejects.toBeInstanceOf(ExternalServiceError);
      expect(bus.published).toHaveLength(0);
    });
  });

  describe('NotifyBulletinsGeneratedUseCase', () => {
    let notifications: InMemoryNotificationRepository;

    beforeEach(() => {
      notifications = new InMemoryNotificationRepository();
      directory.periods.set(2, 'Periodo 1');
      directory.students = [
        { studentId: 10, fullName: 'Ana', userId: 30, guardianName: 'Luis', guardianEmail: 'luis@mail.co' },
        { studentId: 11, fullName: 'Juan', userId: null, guardianName: null, guardianEmail: null },
      ];
    });

    const run = (studentIds = [10, 11]) =>
      new NotifyBulletinsGeneratedUseCase(
        directory,
        notifications,
        clock,
        settings,
        new EmailDelivery(sender, logs, clock),
        new RateLimitedDispatcher(new InstantDelay()),
      ).execute({ periodId: 2, studentIds });

    it('notifies students in-app and e-mails guardians', async () => {
      await expect(run()).resolves.toEqual({ notifications: 1, emailsSent: 1, emailsFailed: 0 });
      expect(notifications.store.all()[0]).toMatchObject({ userId: 30, title: 'Boletín disponible', type: 'success' });
      expect(sender.sent[0].message.subject).toBe('Boletín de Periodo 1 disponible — Ana');
    });

    it('skips e-mails when SMTP is not configured and ignores empty lists', async () => {
      settings = new CommunicationSettings(new InMemorySettingsStore());
      await expect(run()).resolves.toEqual({ notifications: 1, emailsSent: 0, emailsFailed: 0 });
      await expect(run([])).resolves.toEqual({ notifications: 0, emailsSent: 0, emailsFailed: 0 });
      expect(sender.sent).toHaveLength(0);
    });
  });
});
