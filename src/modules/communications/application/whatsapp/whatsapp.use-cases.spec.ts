import { createHmac } from 'node:crypto';
import {
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../../shared/domain/domain-error.js';
import { FixedClock } from '../../../../shared/testing/fakes.js';
import { WhatsAppLog } from '../../domain/whatsapp/whatsapp-log.js';
import { HmacWebhookSignature } from '../../infrastructure/adapters/whatsapp/hmac-webhook-signature.js';
import { FakeDirectory } from '../../testing/fake-directory.js';
import { configuredSettings, FakeWhatsAppGateway, InMemorySettingsStore, InstantDelay } from '../../testing/fakes.js';
import { actor, templateData, templateWith } from '../../testing/fixtures.js';
import {
  InMemoryWhatsAppLogRepository,
  InMemoryWhatsAppTemplateRepository,
} from '../../testing/in-memory-repositories.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import { WhatsAppDelivery } from '../services/whatsapp-delivery.js';
import { GetWhatsAppKpisUseCase } from './get-whatsapp-kpis.use-case.js';
import { ListWhatsAppLogsUseCase } from './list-whatsapp-logs.use-case.js';
import {
  CreateWhatsAppTemplateUseCase,
  DeleteWhatsAppTemplateUseCase,
  GetWhatsAppTemplateUseCase,
  ListWhatsAppTemplatesUseCase,
  UpdateWhatsAppTemplateUseCase,
} from './manage-whatsapp-templates.use-cases.js';
import { NotifyEventUseCase } from './notify-event.use-case.js';
import { SendPaymentConfirmationUseCase } from './send-payment-confirmation.use-case.js';
import { SendSingleWhatsAppUseCase } from './send-single-whatsapp.use-case.js';
import { HandleWhatsAppStatusWebhookUseCase, VerifyWhatsAppWebhookUseCase } from './whatsapp-webhook.use-cases.js';

describe('WhatsApp use cases', () => {
  let templates: InMemoryWhatsAppTemplateRepository;
  let logs: InMemoryWhatsAppLogRepository;
  let gateway: FakeWhatsAppGateway;
  let store: InMemorySettingsStore;
  let settings: CommunicationSettings;
  let delivery: WhatsAppDelivery;
  let directory: FakeDirectory;

  beforeEach(async () => {
    templates = new InMemoryWhatsAppTemplateRepository();
    await templates.save(templateWith('evento_colegio', 3));
    await templates.save(templateWith('pago_confirmado', 4));
    logs = new InMemoryWhatsAppLogRepository();
    gateway = new FakeWhatsAppGateway();
    store = configuredSettings({ whatsapp_app_secret: 'app-secret', whatsapp_webhook_verify_token: 'verify-me' });
    settings = new CommunicationSettings(store);
    delivery = new WhatsAppDelivery(gateway, logs, new FixedClock());
    directory = new FakeDirectory();
  });

  describe('SendSingleWhatsAppUseCase', () => {
    const send = (phone: string, variables: string[], templateName = 'evento_colegio') =>
      new SendSingleWhatsAppUseCase(templates, settings, delivery).execute({
        actor: actor(),
        phone,
        templateName,
        variables,
      });

    it('sends to the normalized number', async () => {
      await expect(send('3001234567', ['a', 'b', 'c'])).resolves.toEqual({
        phone: '573001234567',
        messageId: 'wamid.1',
      });
      expect(logs.store.all()[0]).toMatchObject({ status: 'sent', createdBy: 1 });
    });

    it('validates number and variables before calling Meta', async () => {
      await expect(send('123', ['a', 'b', 'c'])).rejects.toMatchObject({ code: 'INVALID_PHONE' });
      await expect(send('3001234567', ['a'])).rejects.toMatchObject({ code: 'TEMPLATE_VARIABLES_MISMATCH' });
      expect(gateway.sent).toHaveLength(0);
      expect(logs.store.all()).toHaveLength(0);
    });

    it('logs and reports provider errors', async () => {
      gateway.failFor.add('573001234567');
      await expect(send('3001234567', ['a', 'b', 'c'])).rejects.toBeInstanceOf(ExternalServiceError);
      expect(logs.store.all()[0].status).toBe('failed');
    });

    it('requires configuration and an active template', async () => {
      const inactive = templateWith('pendiente', 1, { status: 'pending' });
      await templates.save(inactive);
      await expect(send('3001234567', ['a'], 'pendiente')).rejects.toMatchObject({ code: 'TEMPLATE_NOT_ACTIVE' });
      settings = new CommunicationSettings(new InMemorySettingsStore());
      await expect(send('3001234567', ['a', 'b', 'c'])).rejects.toMatchObject({ code: 'WHATSAPP_NOT_CONFIGURED' });
    });
  });

  describe('NotifyEventUseCase', () => {
    const notify = (overrides: Partial<{ date: string; name: string; details: string | null }> = {}) =>
      new NotifyEventUseCase(
        directory,
        templates,
        settings,
        delivery,
        new RateLimitedDispatcher(new InstantDelay()),
      ).execute({
        actor: actor(),
        date: '2026-04-10',
        name: 'Feria de ciencias',
        details: null,
        ...overrides,
      });

    it('notifies every guardian with a mobile (RN-COM-10)', async () => {
      directory.mobiles = [
        { guardianId: 1, name: 'A', mobile: '3001111111' },
        { guardianId: 2, name: 'B', mobile: '3002222222' },
      ];
      await expect(notify()).resolves.toMatchObject({ total: 2, sent: 2, failed: 0 });
      expect(gateway.sent[0].message.bodyParameters).toEqual(['10/04/2026', 'Feria de ciencias', '-']);
    });

    it.each([
      [{ name: ' ' }, 'EVENT_DATA_REQUIRED'],
      [{ date: '2026-02-30' }, 'INVALID_DATE'],
      [{}, 'NO_RECIPIENTS'],
    ])('rejects %o', async (overrides, code) => {
      await expect(notify(overrides)).rejects.toMatchObject({ code });
    });
  });

  describe('SendPaymentConfirmationUseCase', () => {
    const confirm = (paymentId = 5) =>
      new SendPaymentConfirmationUseCase(directory, templates, settings, delivery).execute({ paymentId, userId: 1 });
    const payment = {
      paymentId: 5,
      receiptNumber: null,
      amount: 350000,
      studentId: 10,
      studentName: 'Ana Pérez',
      guardianName: 'Luis',
      guardianMobile: '3001234567',
    };

    it('confirms with [guardian, amount, student, receipt | #id] (RN-COM-09)', async () => {
      directory.payments = [payment];
      await expect(confirm()).resolves.toEqual({ phone: '573001234567', messageId: 'wamid.1' });
      expect(gateway.sent[0].message.bodyParameters).toEqual(['Luis', '$350.000', 'Ana Pérez', '#5']);
      expect(logs.store.all()[0].studentId).toBe(10);
    });

    it('fails for unknown payments or guardians without mobile', async () => {
      await expect(confirm(99)).rejects.toBeInstanceOf(NotFoundError);
      directory.payments = [{ ...payment, guardianMobile: null }];
      await expect(confirm()).rejects.toMatchObject({ code: 'GUARDIAN_WITHOUT_MOBILE' });
    });
  });

  describe('dashboard', () => {
    it('reports configuration, totals and logs', async () => {
      await logs.save(
        WhatsAppLog.sent({ studentId: 3, templateName: 't', phone: '573001234567', createdBy: 1 }, 'w1', new Date()),
      );
      await expect(new GetWhatsAppKpisUseCase(logs, settings).execute()).resolves.toEqual({
        configured: true,
        totals: { sent: 1, delivered: 0, read: 0, failed: 0 },
      });
      const page = await new ListWhatsAppLogsUseCase(logs).execute({ criteria: {}, page: { page: 1, limit: 20 } });
      expect(page.items[0]).toMatchObject({ studentName: 'Alumno 3', phone: '573001234567' });
    });
  });

  describe('template management', () => {
    it('creates, reads, updates and deletes templates with unique names', async () => {
      const created = await new CreateWhatsAppTemplateUseCase(templates).execute(templateData({ name: 'nueva' }));
      expect(created).toMatchObject({ name: 'nueva', placeholderCount: 2 });
      await expect(
        new CreateWhatsAppTemplateUseCase(templates).execute(templateData({ name: 'nueva' })),
      ).rejects.toBeInstanceOf(ConflictError);

      await expect(new GetWhatsAppTemplateUseCase(templates).execute({ name: 'nueva' })).resolves.toMatchObject({
        id: created.id,
      });
      await expect(new GetWhatsAppTemplateUseCase(templates).execute({ id: 999 })).rejects.toBeInstanceOf(
        NotFoundError,
      );

      const update = new UpdateWhatsAppTemplateUseCase(templates);
      await expect(
        update.execute({ id: created.id, data: templateData({ name: 'evento_colegio' }) }),
      ).rejects.toBeInstanceOf(ConflictError);
      await expect(
        update.execute({ id: created.id, data: templateData({ name: 'nueva', status: 'rejected' }) }),
      ).resolves.toMatchObject({
        status: 'rejected',
      });
      await expect(update.execute({ id: 999, data: templateData() })).rejects.toBeInstanceOf(NotFoundError);

      const active = await new ListWhatsAppTemplatesUseCase(templates).execute({ status: 'active' });
      expect(active.map((t) => t.name)).toEqual(['evento_colegio', 'pago_confirmado']);

      await new DeleteWhatsAppTemplateUseCase(templates).execute(created.id);
      await expect(new DeleteWhatsAppTemplateUseCase(templates).execute(created.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('Meta webhook', () => {
    const sign = (body: Buffer, secret = 'app-secret') =>
      `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    const handler = () => new HandleWhatsAppStatusWebhookUseCase(logs, new HmacWebhookSignature(), settings);
    const statusBody = (statuses: unknown[]) =>
      Buffer.from(
        JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses } }] }] }),
      );

    it('verifies the subscription handshake', async () => {
      const verify = new VerifyWhatsAppWebhookUseCase(settings);
      await expect(verify.execute({ mode: 'subscribe', token: 'verify-me', challenge: '42' })).resolves.toBe('42');
      await expect(verify.execute({ mode: 'subscribe', token: 'otro', challenge: '42' })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('applies signed delivery receipts', async () => {
      const log = WhatsAppLog.sent(
        { studentId: null, templateName: 't', phone: '573001234567', createdBy: 1 },
        'wamid.A',
        new Date(),
      );
      await logs.save(log);
      const body = statusBody([
        { id: 'wamid.A', status: 'delivered' },
        { id: 'wamid.A', status: 'read' },
        { id: 'wamid.desconocido', status: 'read' },
        { id: 'wamid.A', status: 'raro' },
      ]);

      await expect(handler().execute({ rawBody: body, signature: sign(body) })).resolves.toEqual({
        receipts: 3,
        updated: 2,
      });
      expect(log.status).toBe('read');
    });

    it('stores the error of failed deliveries', async () => {
      const log = WhatsAppLog.sent(
        { studentId: null, templateName: 't', phone: '573001234567', createdBy: 1 },
        'wamid.B',
        new Date(),
      );
      await logs.save(log);
      const body = statusBody([
        {
          id: 'wamid.B',
          status: 'failed',
          errors: [{ title: 'Re-engagement message', error_data: { details: '24h' } }],
        },
      ]);
      await handler().execute({ rawBody: body, signature: sign(body) });
      expect(log).toMatchObject({ status: 'failed', response: 'Re-engagement message: 24h' });
    });

    it('rejects unsigned, tampered or unconfigured requests', async () => {
      const body = statusBody([]);
      await expect(handler().execute({ rawBody: body, signature: sign(body, 'otra') })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      await expect(handler().execute({ rawBody: undefined, signature: sign(body) })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      const invalid = Buffer.from('no-json');
      await expect(handler().execute({ rawBody: invalid, signature: sign(invalid) })).rejects.toMatchObject({
        code: 'INVALID_WEBHOOK_PAYLOAD',
      });
      settings = new CommunicationSettings(new InMemorySettingsStore());
      await expect(handler().execute({ rawBody: body, signature: sign(body) })).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
