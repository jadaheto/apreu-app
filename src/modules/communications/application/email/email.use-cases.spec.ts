import { ExternalServiceError, ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { FixedClock } from '../../../../shared/testing/fakes.js';
import { FakeDirectory } from '../../testing/fake-directory.js';
import {
  configuredSettings,
  FakeEmailSender,
  FakeSanitizer,
  InMemoryFileStorage,
  InMemorySettingsStore,
  InstantDelay,
  PDF_BYTES,
  PNG_BYTES,
} from '../../testing/fakes.js';
import { actor } from '../../testing/fixtures.js';
import { InMemoryEmailLogRepository } from '../../testing/in-memory-repositories.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import { GetEmailKpisUseCase } from './get-email-kpis.use-case.js';
import { ListEmailLogsUseCase } from './list-email-logs.use-case.js';
import { SendNoticeEmailUseCase, type SendNoticeEmailInput } from './send-notice-email.use-case.js';
import { TestSmtpConnectionUseCase } from './test-smtp-connection.use-case.js';
import { UploadEmailImageUseCase } from './upload-email-image.use-case.js';

describe('e-mail use cases', () => {
  let directory: FakeDirectory;
  let sender: FakeEmailSender;
  let logs: InMemoryEmailLogRepository;
  let store: InMemorySettingsStore;
  let settings: CommunicationSettings;
  let delay: InstantDelay;
  let delivery: EmailDelivery;

  beforeEach(() => {
    directory = new FakeDirectory();
    sender = new FakeEmailSender();
    logs = new InMemoryEmailLogRepository();
    store = configuredSettings({ email_batch_size: '2', email_batch_pause_ms: '1000' });
    settings = new CommunicationSettings(store);
    delay = new InstantDelay();
    delivery = new EmailDelivery(sender, logs, new FixedClock());
  });

  describe('SendNoticeEmailUseCase', () => {
    const useCase = () =>
      new SendNoticeEmailUseCase(
        directory,
        directory,
        new FakeSanitizer(),
        settings,
        delivery,
        new RateLimitedDispatcher(delay),
      );
    const send = (overrides: Partial<SendNoticeEmailInput> = {}) =>
      useCase().execute({
        actor: actor(),
        audience: { kind: 'all_parents' },
        subject: 'Reunión de padres',
        bodyHtml: '<p>Los esperamos</p><script>alert(1)</script>',
        attachments: [],
        ...overrides,
      });

    beforeEach(() => {
      directory.guardians = [
        { email: 'a@mail.co', name: 'A', gradeId: 1, classroomId: 11 },
        { email: 'A@mail.co', name: 'A bis', gradeId: 1, classroomId: 11 },
        { email: 'b@mail.co', name: 'B', gradeId: 2, classroomId: 21 },
        { email: 'malo', name: 'X', gradeId: 2, classroomId: 21 },
      ];
    });

    it('sends one sanitized message per distinct guardian and logs them (RN-COM-02..06)', async () => {
      const result = await send();

      expect(result).toEqual({ total: 2, sent: 2, failed: 0, skipped: 0, failures: [] });
      expect(sender.sent.map((s) => s.message.to.email)).toEqual(['a@mail.co', 'b@mail.co']);
      expect(sender.sent[0].message.html).toContain('<p>Los esperamos</p>');
      expect(sender.sent[0].message.html).not.toContain('<script>');
      expect(logs.store.all().every((log) => log.type === 'aviso' && log.createdBy === 1)).toBe(true);
    });

    it.each([
      [{ kind: 'by_grade' as const, gradeId: 2 }, ['b@mail.co']],
      [{ kind: 'by_classroom' as const, classroomId: 11 }, ['a@mail.co']],
      [{ kind: 'manual' as const, manualEmails: 'x@mail.co, y@mail.co, roto' }, ['x@mail.co', 'y@mail.co']],
    ])('resolves the audience %o', async (audience, expected) => {
      await send({ audience });
      expect(sender.sent.map((s) => s.message.to.email)).toEqual(expected);
    });

    it('sends to active employees', async () => {
      directory.employees = [{ email: 'profe@colegio.co', name: 'Profe' }];
      await send({ audience: { kind: 'all_employees' } });
      expect(sender.sent.map((s) => s.message.to.email)).toEqual(['profe@colegio.co']);
    });

    it('rate limits the deliveries in batches', async () => {
      directory.guardians = Array.from({ length: 5 }, (_, i) => ({ email: `p${i}@mail.co`, name: null }));
      await send();
      expect(delay.waits).toEqual([1000, 1000]);
    });

    it('reports failures and keeps sending', async () => {
      sender.failFor.add('a@mail.co');
      const result = await send();
      expect(result).toMatchObject({ sent: 1, failed: 1, failures: [{ to: 'a@mail.co' }] });
      expect(logs.store.all().find((log) => log.toEmail === 'a@mail.co')?.status).toBe('failed');
    });

    it('validates and attaches files', async () => {
      await send({ attachments: [{ originalName: 'circular.pdf', size: PDF_BYTES.length, content: PDF_BYTES }] });
      expect(sender.sent[0].message.attachments[0]).toMatchObject({ filename: 'circular.pdf' });
      await expect(
        send({ attachments: [{ originalName: 'virus.exe', size: 3, content: Buffer.from('MZ!') }] }),
      ).rejects.toMatchObject({ code: 'ATTACHMENT_TYPE_NOT_ALLOWED' });
    });

    it.each([
      [{ subject: ' ' }, 'NOTICE_CONTENT_REQUIRED'],
      [{ bodyHtml: '<p> </p><script>x</script>' }, 'NOTICE_CONTENT_REQUIRED'],
      [{ subject: 'Hola\r\nBcc: todos@x.co' }, 'INVALID_SUBJECT'],
      [{ audience: { kind: 'by_grade' as const, gradeId: 99 } }, 'NO_RECIPIENTS'],
    ])('rejects %o', async (overrides, code) => {
      await expect(send(overrides)).rejects.toMatchObject({ code });
      expect(sender.sent).toHaveLength(0);
    });

    it('fails when SMTP is not configured', async () => {
      settings = new CommunicationSettings(new InMemorySettingsStore());
      await expect(send()).rejects.toMatchObject({ code: 'SMTP_NOT_CONFIGURED' });
    });

    it('lets a teacher write only to the classroom they direct', async () => {
      const teacher = actor({ userId: 7, role: Role.TEACHER });
      directory.directors = [{ userId: 7, classroomId: 11 }];

      await expect(
        send({ actor: teacher, audience: { kind: 'by_classroom', classroomId: 11 } }),
      ).resolves.toMatchObject({ sent: 1 });
      await expect(
        send({ actor: teacher, audience: { kind: 'by_classroom', classroomId: 21 } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(send({ actor: teacher, audience: { kind: 'all_parents' } })).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('dashboard and history', () => {
    it('returns KPIs and paginated logs with the sender name', async () => {
      const now = new Date();
      const { EmailLog } = await import('../../domain/email/email-log.js');
      await logs.save(EmailLog.sent({ toEmail: 'a@x.co', subject: 'S', body: 'B', type: 'aviso', createdBy: 2 }, now));
      await logs.save(
        EmailLog.failed(
          { toEmail: 'b@x.co', subject: 'S', body: 'B', type: 'factura_cobro', createdBy: null },
          'e',
          now,
        ),
      );

      await expect(new GetEmailKpisUseCase(logs).execute()).resolves.toEqual({
        total: 2,
        notices: 1,
        billing: 1,
        dian: 0,
        failed: 1,
      });
      const page = await new ListEmailLogsUseCase(logs).execute({
        criteria: { status: 'sent' },
        page: { page: 1, limit: 10 },
      });
      expect(page).toMatchObject({ total: 1, items: [{ toEmail: 'a@x.co', sentByName: 'Usuario 2', status: 'sent' }] });
    });
  });

  describe('TestSmtpConnectionUseCase', () => {
    it('sends a test message to the administrator', async () => {
      const result = await new TestSmtpConnectionUseCase(settings, delivery).execute({
        actor: actor(),
        profile: 'general',
      });
      expect(result).toEqual({ to: 'director@colegio.co', host: 'smtp.hostinger.com', port: 465, security: 'ssl' });
      expect(sender.sent[0].message.subject).toContain('Prueba de configuración');
      expect(logs.store.all()[0].type).toBe('otro');
    });

    it('reports the provider error as an external failure', async () => {
      sender.failFor.add('director@colegio.co');
      await expect(
        new TestSmtpConnectionUseCase(settings, delivery).execute({ actor: actor(), profile: 'general' }),
      ).rejects.toBeInstanceOf(ExternalServiceError);
    });
  });

  describe('UploadEmailImageUseCase', () => {
    const upload = (content: Buffer, kind: 'logo' | 'promo' = 'logo') => {
      const storage = new InMemoryFileStorage();
      const useCase = new UploadEmailImageUseCase(storage, settings);
      return {
        storage,
        result: useCase.execute({ kind, file: { originalName: 'shell.php', size: content.length, content } }),
      };
    };

    it('stores the image under a server-chosen name and saves the setting (legacy bug #1)', async () => {
      const { storage, result } = upload(PNG_BYTES);
      await expect(result).resolves.toEqual({
        kind: 'logo',
        path: 'email/email_logo.png',
        contentType: 'image/png',
        size: PNG_BYTES.length,
      });
      expect(storage.files.has('email/email_logo.png')).toBe(true);
      expect(store.values.email_logo_path).toBe('email/email_logo.png');
    });

    it.each([
      [Buffer.from('GIF89a<?php system($_GET[1]); ?>'), null],
      [Buffer.from('<?php echo 1; ?>'), 'IMAGE_TYPE_NOT_ALLOWED'],
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'IMAGE_TYPE_NOT_ALLOWED'],
      [Buffer.alloc(0), 'IMAGE_REQUIRED'],
      [Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]), 'IMAGE_TOO_LARGE'],
    ])('validates the content %#', async (content, code) => {
      const { storage, result } = upload(content);
      if (code) {
        await expect(result).rejects.toMatchObject({ code });
      } else {
        // A GIF polyglot is stored as .gif, never with the client's .php extension.
        await expect(result).resolves.toMatchObject({ path: 'email/email_logo.gif' });
        expect([...storage.files.keys()].some((path) => path.endsWith('.php'))).toBe(false);
      }
    });

    it('requires a file', async () => {
      await expect(
        new UploadEmailImageUseCase(new InMemoryFileStorage(), settings).execute({ kind: 'promo', file: undefined }),
      ).rejects.toMatchObject({
        code: 'IMAGE_REQUIRED',
      });
    });
  });
});
