import { FixedClock } from '../../../../shared/testing/fakes.js';
import { charge, FakeDirectory } from '../../testing/fake-directory.js';
import {
  configuredSettings,
  FakeEmailSender,
  FakeWhatsAppGateway,
  InMemorySettingsStore,
  InstantDelay,
} from '../../testing/fakes.js';
import { actor, templateWith } from '../../testing/fixtures.js';
import {
  InMemoryEmailLogRepository,
  InMemoryWhatsAppLogRepository,
  InMemoryWhatsAppTemplateRepository,
} from '../../testing/in-memory-repositories.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import { WhatsAppDelivery } from '../services/whatsapp-delivery.js';
import { PreviewBillingNoticesUseCase } from './preview-billing-notices.use-case.js';
import { type SendBillingNoticesInput, SendBillingNoticesUseCase } from './send-billing-notices.use-case.js';

describe('billing notices', () => {
  let directory: FakeDirectory;
  let templates: InMemoryWhatsAppTemplateRepository;
  let sender: FakeEmailSender;
  let gateway: FakeWhatsAppGateway;
  let emailLogs: InMemoryEmailLogRepository;
  let whatsappLogs: InMemoryWhatsAppLogRepository;
  let settings: CommunicationSettings;

  beforeEach(async () => {
    directory = new FakeDirectory();
    directory.charges = [
      charge(),
      charge({ chargeId: 2, studentId: 11, conceptName: null, guardianName: null, guardianEmail: 'LUIS@mail.co' }),
      charge({ chargeId: 3, studentId: 12, guardianEmail: null, guardianMobile: null, netAmount: 100000.5 }),
    ];
    templates = new InMemoryWhatsAppTemplateRepository();
    await templates.save(templateWith('cobro_mensual', 5));
    sender = new FakeEmailSender();
    gateway = new FakeWhatsAppGateway();
    emailLogs = new InMemoryEmailLogRepository();
    whatsappLogs = new InMemoryWhatsAppLogRepository();
    settings = new CommunicationSettings(configuredSettings());
  });

  const useCase = () =>
    new SendBillingNoticesUseCase(
      directory,
      templates,
      settings,
      new EmailDelivery(sender, emailLogs, new FixedClock()),
      new WhatsAppDelivery(gateway, whatsappLogs, new FixedClock()),
      new RateLimitedDispatcher(new InstantDelay()),
    );
  const send = (overrides: Partial<SendBillingNoticesInput> = {}) =>
    useCase().execute({ actor: actor(), month: '2026-02', channels: ['email', 'whatsapp'], ...overrides });

  it('previews the run using the real month range', async () => {
    const preview = await new PreviewBillingNoticesUseCase(directory).execute({ month: '2026-02' });
    expect(directory.lastChargesFilter).toEqual({ from: '2026-02-01', to: '2026-02-28', conceptId: undefined });
    expect(preview).toEqual({
      month: '2026-02',
      charges: 3,
      totalAmount: 800000.5,
      guardiansWithEmail: 1,
      guardiansWithMobile: 1,
      studentsWithoutEmail: 1,
    });
  });

  it('sends one e-mail and one WhatsApp per charge, skipping missing contacts (RN-COM-07/08)', async () => {
    const result = await send();

    expect(result.charges).toBe(3);
    expect(result.email).toMatchObject({ total: 3, sent: 2, skipped: 1 });
    expect(result.whatsapp).toMatchObject({ total: 3, sent: 2, skipped: 1 });
    expect(sender.sent[1].message.subject).toBe('Cobro de Mensualidad — Ana Pérez');
    expect(gateway.sent[0].message.bodyParameters).toEqual([
      'Luis Pérez',
      'Pensión marzo',
      '$350.000',
      '10/03/2026',
      'A-001',
    ]);
    expect(gateway.sent[1].message.bodyParameters.slice(0, 2)).toEqual(['Acudiente', 'Mensualidad']);
  });

  it('logs billing e-mails sent from any screen (legacy bug #13)', async () => {
    await send({ channels: ['email'] });
    expect(emailLogs.store.all().map((log) => log.type)).toEqual(['factura_cobro', 'factura_cobro']);
    expect(gateway.sent).toHaveLength(0);
  });

  it('uses the selected template (legacy bug #12) and checks its variables', async () => {
    await templates.save(templateWith('cobro_corto', 2));
    await expect(send({ channels: ['whatsapp'], templateName: 'cobro_corto' })).rejects.toMatchObject({
      code: 'TEMPLATE_VARIABLES_MISMATCH',
    });
    await expect(send({ channels: ['whatsapp'], templateName: 'no_existe' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it.each([
    [{ channels: [] }, 'CHANNEL_REQUIRED'],
    [{ month: '2026-2' }, 'INVALID_MONTH'],
  ])('rejects %o', async (overrides, code) => {
    await expect(send(overrides as Partial<SendBillingNoticesInput>)).rejects.toMatchObject({ code });
  });

  it('fails when there are no pending charges or channels are not configured', async () => {
    directory.charges = [];
    await expect(send()).rejects.toMatchObject({ code: 'NO_PENDING_CHARGES' });
    directory.charges = [charge()];
    settings = new CommunicationSettings(new InMemorySettingsStore({ smtp_general_password: 'x' }));
    await expect(send({ channels: ['whatsapp'] })).rejects.toMatchObject({ code: 'WHATSAPP_NOT_CONFIGURED' });
  });
});
