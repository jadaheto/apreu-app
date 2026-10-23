import { FixedClock } from '../../../../shared/testing/fakes.js';
import { templateWith } from '../../testing/fixtures.js';
import { FakeEmailSender, FakeWhatsAppGateway, InMemorySettingsStore, InstantDelay } from '../../testing/fakes.js';
import { InMemoryEmailLogRepository, InMemoryWhatsAppLogRepository } from '../../testing/in-memory-repositories.js';
import { CommunicationSettings } from './communication-settings.js';
import { summarize } from './delivery-summary.js';
import { EmailDelivery } from './email-delivery.js';
import { EmailTemplates } from './email-templates.js';
import { RateLimitedDispatcher } from './rate-limited-dispatcher.js';
import { WhatsAppDelivery } from './whatsapp-delivery.js';

describe('CommunicationSettings', () => {
  const settings = (values: Record<string, string>) => new CommunicationSettings(new InMemorySettingsStore(values));

  it('is not configured without an SMTP password', async () => {
    await expect(settings({}).smtp('general')).resolves.toBeNull();
    await expect(settings({}).requireSmtp('general')).rejects.toMatchObject({ code: 'SMTP_NOT_CONFIGURED' });
  });

  it('applies the platform defaults of RN-COM-01', async () => {
    await expect(settings({ smtp_general_password: 'x' }).smtp('general')).resolves.toEqual({
      host: 'smtp.hostinger.com',
      port: 465,
      security: 'ssl',
      username: 'noreply@apreu.co',
      password: 'x',
      fromEmail: 'noreply@apreu.co',
      fromName: 'Apreu ERP',
    });
  });

  it.each([
    [{ smtp_general_port: '587' }, 'starttls'],
    [{ smtp_general_port: '587', smtp_general_encryption: 'ssl' }, 'ssl'],
    [{ smtp_general_port: '25', smtp_general_encryption: 'none' }, 'none'],
    [{ smtp_general_port: '587', smtp_general_encryption: 'tls' }, 'starttls'],
  ])('derives the transport security %o (legacy bug #8)', async (values, security) => {
    await expect(settings({ smtp_general_password: 'x', ...values }).smtp('general')).resolves.toMatchObject({
      security,
    });
  });

  it('uses the invoicing account when complete and falls back to the general one', async () => {
    const invoicing = {
      smtp_host: 'mail.colegio.co',
      smtp_username: 'facturas@colegio.co',
      smtp_password: 'y',
      smtp_port: '587',
    };
    await expect(settings({ smtp_general_password: 'x', ...invoicing }).smtp('invoicing')).resolves.toMatchObject({
      host: 'mail.colegio.co',
      fromEmail: 'facturas@colegio.co',
      security: 'starttls',
    });
    await expect(
      settings({ smtp_general_password: 'x', smtp_host: 'solo-host' }).smtp('invoicing'),
    ).resolves.toMatchObject({
      host: 'smtp.hostinger.com',
    });
  });

  it('exposes WhatsApp credentials only when token and phone id exist (RN-COM-12)', async () => {
    await expect(settings({ whatsapp_token: 't' }).whatsapp()).resolves.toMatchObject({ credentials: null });
    await expect(settings({}).requireWhatsApp()).rejects.toMatchObject({ code: 'WHATSAPP_NOT_CONFIGURED' });
    await expect(
      settings({ whatsapp_token: 't', whatsapp_phone_id: '1', whatsapp_app_secret: 's' }).whatsapp(),
    ).resolves.toEqual({ credentials: { token: 't', phoneNumberId: '1' }, appSecret: 's', verifyToken: null });
  });

  it('accepts only http(s) n8n URLs', async () => {
    const ai = await settings({
      n8n_webhook_url: 'https://n8n.co/webhook/apreu-ai',
      n8n_marketing_url: 'javascript:alert(1)',
      n8n_auth_token: 'tok',
    }).ai();
    expect(ai).toEqual({ chat: { url: 'https://n8n.co/webhook/apreu-ai', authToken: 'tok' }, marketing: null });
  });

  it('validates branding colors and delivery policies', async () => {
    const custom = settings({
      primary_color: 'red;background:url(x)',
      email_batch_size: '5',
      email_batch_pause_ms: '0',
    });
    await expect(custom.branding()).resolves.toMatchObject({
      primaryColor: '#4f46e5',
      schoolName: 'Institución Educativa Apreu',
      businessName: 'Institución Educativa Apreu',
    });
    await expect(custom.deliveryPolicy('email')).resolves.toEqual({ batchSize: 5, pauseMs: 0 });
    await expect(settings({ whatsapp_batch_size: '0' }).deliveryPolicy('whatsapp')).resolves.toEqual({
      batchSize: 20,
      pauseMs: 1000,
    });
  });

  it('stores the e-mail image paths', async () => {
    const store = new InMemorySettingsStore();
    await new CommunicationSettings(store).saveEmailImagePath('promo', 'email/email_promo.png');
    expect(store.values).toEqual({ email_promo_path: 'email/email_promo.png' });
  });
});

describe('RateLimitedDispatcher', () => {
  it('pauses between batches and keeps the order', async () => {
    const delay = new InstantDelay();
    const results = await new RateLimitedDispatcher(delay).run(
      [1, 2, 3, 4, 5],
      { batchSize: 2, pauseMs: 500 },
      async (n) => n * 10,
    );
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(delay.waits).toEqual([500, 500]);
  });

  it('does not pause when the pause is zero', async () => {
    const delay = new InstantDelay();
    await new RateLimitedDispatcher(delay).run([1, 2, 3], { batchSize: 1, pauseMs: 0 }, async (n) => n);
    expect(delay.waits).toEqual([]);
  });
});

describe('EmailTemplates', () => {
  it('escapes interpolated values (legacy bug #28)', () => {
    const email = EmailTemplates.billingNotice({
      studentName: '<script>x</script>Ana',
      studentCode: 'A-1',
      conceptName: null,
      amount: 850000,
      dueDate: '2026-03-10',
      schoolName: 'Colegio & Cía',
    });
    expect(email.subject).toBe('Cobro de Mensualidad — <script>x</script>Ana');
    expect(email.html).toContain('&lt;script&gt;x&lt;/script&gt;Ana');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('$850.000');
    expect(email.html).toContain('10/03/2026');
    expect(email.text).toContain('Aviso de Cobro');
  });

  it('embeds the sanitized notice body and the school colors', () => {
    const email = EmailTemplates.notice({
      subject: 'Reunión <padres>',
      safeBodyHtml: '<p>Hola</p>',
      schoolName: 'Colegio',
      primaryColor: '#123456',
    });
    expect(email.html).toContain('<p>Hola</p>');
    expect(email.html).toContain('Reunión &lt;padres&gt;');
    expect(email.html).toContain('#123456');
  });

  it('references inline images by content id in invoices', () => {
    const email = EmailTemplates.invoice({
      number: 'SETP1',
      customerName: 'Cliente',
      total: 100000,
      issueDate: '2026-03-01',
      businessName: 'Colegio SAS',
      nit: '900',
      resolutionNumber: '187',
      brandColor: '#059669',
      logoCid: 'logo@apreu',
      promoCid: null,
    });
    expect(email.subject).toBe('Factura Electrónica SETP1 - Colegio SAS');
    expect(email.html).toContain('cid:logo@apreu');
    expect(email.html).not.toContain('Promoción');
  });

  it('renders bulletin and SMTP test e-mails', () => {
    expect(
      EmailTemplates.bulletinAvailable({
        studentName: 'Ana',
        periodName: 'Periodo 1',
        guardianName: null,
        schoolName: 'C',
        primaryColor: '#000000',
      }).subject,
    ).toBe('Boletín de Periodo 1 disponible — Ana');
    expect(EmailTemplates.smtpTest({ schoolName: 'C', primaryColor: '#000000' }).text).toContain(
      'configuración funciona',
    );
  });
});

describe('summarize', () => {
  it('counts sent, failed and skipped deliveries', () => {
    const summary = summarize(
      [
        { sent: true, error: null },
        { sent: false, error: 'x' },
      ],
      (index) => ['a', 'b'][index],
      3,
    );
    expect(summary).toEqual({ total: 5, sent: 1, failed: 1, skipped: 3, failures: [{ to: 'b', error: 'x' }] });
  });
});

describe('EmailDelivery', () => {
  const account = {
    host: 'h',
    port: 465,
    security: 'ssl' as const,
    username: 'u',
    password: 'p',
    fromEmail: 'f@x.co',
    fromName: 'F',
  };
  const content = { subject: 'Asunto', html: '<p>Cuerpo</p>', text: 'Cuerpo' };

  it('sends and logs each attempt with its own error (legacy bug #6)', async () => {
    const sender = new FakeEmailSender();
    const logs = new InMemoryEmailLogRepository();
    const delivery = new EmailDelivery(sender, logs, new FixedClock());
    sender.failFor.add('malo@x.co');

    await expect(
      delivery.deliver(account, { to: { email: 'bueno@x.co', name: 'B' }, content, type: 'aviso', createdBy: 1 }),
    ).resolves.toEqual({
      to: 'bueno@x.co',
      sent: true,
      error: null,
    });
    const failed = await delivery.deliver(account, {
      to: { email: 'malo@x.co', name: null },
      content,
      type: 'aviso',
      createdBy: 1,
    });

    expect(failed.sent).toBe(false);
    expect(sender.sent[0].message).toMatchObject({ subject: 'Asunto', text: 'Cuerpo', attachments: [] });
    expect(logs.store.all().map((log) => [log.toEmail, log.status, log.errorMessage])).toEqual([
      ['bueno@x.co', 'sent', null],
      ['malo@x.co', 'failed', expect.stringContaining('malo@x.co rechazado')],
    ]);
  });
});

describe('WhatsAppDelivery', () => {
  const credentials = { token: 't', phoneNumberId: '1' };

  it('normalizes the number, sends and logs (RN-COM-11, RN-COM-13)', async () => {
    const gateway = new FakeWhatsAppGateway();
    const logs = new InMemoryWhatsAppLogRepository();
    const delivery = new WhatsAppDelivery(gateway, logs, new FixedClock());
    const template = templateWith('evento_colegio', 1);

    const outcome = await delivery.deliver(credentials, {
      phone: '300 123 4567',
      template,
      values: ['Feria'],
      studentId: 9,
      createdBy: 1,
    });

    expect(outcome).toEqual({ phone: '573001234567', sent: true, messageId: 'wamid.1', error: null });
    expect(gateway.sent[0]).toMatchObject({ to: '573001234567', message: { bodyParameters: ['Feria'] } });
    expect(logs.store.all()[0]).toMatchObject({ phone: '573001234567', status: 'sent', studentId: 9 });
  });

  it('logs invalid numbers and provider errors as failed without throwing', async () => {
    const gateway = new FakeWhatsAppGateway();
    gateway.failFor.add('573009999999');
    const logs = new InMemoryWhatsAppLogRepository();
    const delivery = new WhatsAppDelivery(gateway, logs, new FixedClock());
    const template = templateWith('evento_colegio', 1);

    const invalid = await delivery.deliver(credentials, {
      phone: '123',
      template,
      values: ['x'],
      studentId: null,
      createdBy: 1,
    });
    const rejected = await delivery.deliver(credentials, {
      phone: '3009999999',
      template,
      values: ['x'],
      studentId: null,
      createdBy: 1,
    });

    expect(invalid).toMatchObject({ sent: false, phone: '123' });
    expect(rejected).toMatchObject({ sent: false, error: expect.stringContaining('número no registrado') });
    expect(logs.store.all().map((log) => log.status)).toEqual(['failed', 'failed']);
  });
});
