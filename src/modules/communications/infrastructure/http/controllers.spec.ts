import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import { AskAssistantUseCase } from '../../application/ai/ask-assistant.use-case.js';
import { ListChatLogsUseCase, ListMyChatHistoryUseCase } from '../../application/ai/list-chat-history.use-cases.js';
import {
  GenerateMarketingContentUseCase,
  ListMarketingTypesUseCase,
  ListMyMarketingGenerationsUseCase,
} from '../../application/ai/marketing.use-cases.js';
import { PreviewBillingNoticesUseCase } from '../../application/billing/preview-billing-notices.use-case.js';
import { SendBillingNoticesUseCase } from '../../application/billing/send-billing-notices.use-case.js';
import { GetEmailKpisUseCase } from '../../application/email/get-email-kpis.use-case.js';
import { ListEmailLogsUseCase } from '../../application/email/list-email-logs.use-case.js';
import { SendNoticeEmailUseCase } from '../../application/email/send-notice-email.use-case.js';
import { TestSmtpConnectionUseCase } from '../../application/email/test-smtp-connection.use-case.js';
import { UploadEmailImageUseCase } from '../../application/email/upload-email-image.use-case.js';
import { SendInvoiceEmailUseCase } from '../../application/events/send-invoice-email.use-case.js';
import { CreateNotificationsUseCase } from '../../application/notifications/create-notifications.use-case.js';
import { ListMyNotificationsUseCase } from '../../application/notifications/list-my-notifications.use-case.js';
import {
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../application/notifications/mark-notification-read.use-case.js';
import { GetWhatsAppKpisUseCase } from '../../application/whatsapp/get-whatsapp-kpis.use-case.js';
import { ListWhatsAppLogsUseCase } from '../../application/whatsapp/list-whatsapp-logs.use-case.js';
import {
  CreateWhatsAppTemplateUseCase,
  DeleteWhatsAppTemplateUseCase,
  GetWhatsAppTemplateUseCase,
  ListWhatsAppTemplatesUseCase,
  UpdateWhatsAppTemplateUseCase,
} from '../../application/whatsapp/manage-whatsapp-templates.use-cases.js';
import { NotifyEventUseCase } from '../../application/whatsapp/notify-event.use-case.js';
import { SendPaymentConfirmationUseCase } from '../../application/whatsapp/send-payment-confirmation.use-case.js';
import { SendSingleWhatsAppUseCase } from '../../application/whatsapp/send-single-whatsapp.use-case.js';
import {
  HandleWhatsAppStatusWebhookUseCase,
  VerifyWhatsAppWebhookUseCase,
} from '../../application/whatsapp/whatsapp-webhook.use-cases.js';
import { actor, templateData } from '../../testing/fixtures.js';
import { AiAssistantController } from './ai-assistant.controller.js';
import { BillingNoticesController } from './billing-notices.controller.js';
import { EmailLogsQueryDto, SendNoticeDto } from './dto/email.dto.js';
import { EmailController } from './email.controller.js';
import { MarketingController } from './marketing.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { WhatsAppTemplatesController } from './whatsapp-templates.controller.js';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller.js';
import { WhatsAppController } from './whatsapp.controller.js';
import { ChatLogsQueryDto, MarketingHistoryQueryDto } from './dto/ai.dto.js';
import { MyNotificationsQueryDto } from './dto/notifications.dto.js';
import { WhatsAppLogsQueryDto, WhatsAppTemplateDto } from './dto/whatsapp.dto.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue('ok') });
const query = <T extends object>(type: new () => T, values: Partial<T> = {}): T => Object.assign(new type(), values);

async function build<T>(
  controller: new (...args: never[]) => T,
  tokens: unknown[],
  extra: { provide: unknown; useValue: unknown }[] = [],
) {
  const mocks = new Map(tokens.map((token) => [token, mock()]));
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      ...[...mocks].map(([provide, useValue]) => ({ provide: provide as never, useValue })),
      ...extra.map((item) => ({ provide: item.provide as never, useValue: item.useValue })),
    ],
  }).compile();
  return { controller: moduleRef.get(controller), mocks: (token: unknown) => mocks.get(token)!.execute };
}

describe('communications controllers', () => {
  const me = actor();

  it('EmailController delegates to its use cases', async () => {
    const { controller, mocks } = await build(EmailController, [
      GetEmailKpisUseCase,
      ListEmailLogsUseCase,
      SendNoticeEmailUseCase,
      TestSmtpConnectionUseCase,
      UploadEmailImageUseCase,
      SendInvoiceEmailUseCase,
    ]);

    await controller.getKpis();
    expect(mocks(GetEmailKpisUseCase)).toHaveBeenCalled();

    await controller.listLogs(query(EmailLogsQueryDto, { type: 'aviso', search: 'x', page: 2, limit: 5 }));
    expect(mocks(ListEmailLogsUseCase)).toHaveBeenCalledWith({
      criteria: { type: 'aviso', status: undefined, search: 'x' },
      page: { page: 2, limit: 5 },
    });

    const dto = Object.assign(new SendNoticeDto(), {
      audience: 'by_grade',
      gradeId: 3,
      subject: 'S',
      bodyHtml: '<p>B</p>',
    });
    await controller.sendNotice(me, dto, [{ originalname: 'a.pdf', size: 4, buffer: Buffer.from('%PDF') }]);
    expect(mocks(SendNoticeEmailUseCase)).toHaveBeenCalledWith({
      actor: me,
      audience: { kind: 'by_grade', gradeId: 3, classroomId: undefined, manualEmails: undefined },
      subject: 'S',
      bodyHtml: '<p>B</p>',
      attachments: [{ originalName: 'a.pdf', size: 4, content: Buffer.from('%PDF') }],
    });

    await controller.testSmtp(me, {});
    expect(mocks(TestSmtpConnectionUseCase)).toHaveBeenCalledWith({ actor: me, profile: 'general' });

    await controller.uploadImage({ type: 'logo' }, undefined);
    expect(mocks(UploadEmailImageUseCase)).toHaveBeenCalledWith({ kind: 'logo', file: undefined });

    await controller.sendInvoice(me, 9);
    expect(mocks(SendInvoiceEmailUseCase)).toHaveBeenCalledWith({ dianInvoiceId: 9, userId: 1 });
  });

  it('BillingNoticesController delegates preview and send', async () => {
    const { controller, mocks } = await build(BillingNoticesController, [
      PreviewBillingNoticesUseCase,
      SendBillingNoticesUseCase,
    ]);
    await controller.getPreview({ month: '2026-03' });
    expect(mocks(PreviewBillingNoticesUseCase)).toHaveBeenCalledWith({ month: '2026-03', conceptId: undefined });
    await controller.sendNotices(me, { month: '2026-03', conceptId: 2, channels: ['email'] });
    expect(mocks(SendBillingNoticesUseCase)).toHaveBeenCalledWith({
      actor: me,
      month: '2026-03',
      conceptId: 2,
      channels: ['email'],
      templateName: undefined,
    });
  });

  it('WhatsAppController delegates sends and dashboards', async () => {
    const { controller, mocks } = await build(WhatsAppController, [
      GetWhatsAppKpisUseCase,
      ListWhatsAppLogsUseCase,
      SendSingleWhatsAppUseCase,
      NotifyEventUseCase,
      SendPaymentConfirmationUseCase,
    ]);
    await controller.getKpis();
    await controller.listLogs(query(WhatsAppLogsQueryDto, { status: 'read' }));
    expect(mocks(ListWhatsAppLogsUseCase)).toHaveBeenCalledWith({
      criteria: { status: 'read', search: undefined },
      page: { page: 1, limit: 20 },
    });
    await controller.sendMessage(me, { phone: '3001234567', templateName: 't', variables: ['a'] });
    expect(mocks(SendSingleWhatsAppUseCase)).toHaveBeenCalledWith({
      actor: me,
      phone: '3001234567',
      templateName: 't',
      variables: ['a'],
    });
    await controller.notifyEvent(me, { date: '2026-04-10', name: 'Feria' });
    expect(mocks(NotifyEventUseCase)).toHaveBeenCalledWith({
      actor: me,
      date: '2026-04-10',
      name: 'Feria',
      details: undefined,
    });
    await controller.confirmPayment(me, 5);
    expect(mocks(SendPaymentConfirmationUseCase)).toHaveBeenCalledWith({ paymentId: 5, userId: 1 });
    expect(mocks(GetWhatsAppKpisUseCase)).toHaveBeenCalled();
  });

  it('WhatsAppTemplatesController maps the DTO to template data', async () => {
    const { controller, mocks } = await build(WhatsAppTemplatesController, [
      ListWhatsAppTemplatesUseCase,
      GetWhatsAppTemplateUseCase,
      CreateWhatsAppTemplateUseCase,
      UpdateWhatsAppTemplateUseCase,
      DeleteWhatsAppTemplateUseCase,
    ]);
    const dto = Object.assign(new WhatsAppTemplateDto(), {
      name: 'n',
      language: 'es_CO',
      category: 'utility',
      body: 'b',
      variables: [],
      status: 'active',
      headerType: 'none',
    });
    const expected = templateData({ name: 'n', body: 'b', variables: [] });

    await controller.list({ status: 'active' });
    expect(mocks(ListWhatsAppTemplatesUseCase)).toHaveBeenCalledWith({ status: 'active' });
    await controller.byName('cobro_mensual');
    expect(mocks(GetWhatsAppTemplateUseCase)).toHaveBeenCalledWith({ name: 'cobro_mensual' });
    await controller.byId(3);
    expect(mocks(GetWhatsAppTemplateUseCase)).toHaveBeenCalledWith({ id: 3 });
    await controller.create(dto);
    expect(mocks(CreateWhatsAppTemplateUseCase)).toHaveBeenCalledWith(expected);
    await controller.update(3, dto);
    expect(mocks(UpdateWhatsAppTemplateUseCase)).toHaveBeenCalledWith({ id: 3, data: expected });
    await controller.remove(3);
    expect(mocks(DeleteWhatsAppTemplateUseCase)).toHaveBeenCalledWith(3);
  });

  it('WhatsAppWebhookController checks the tenant and forwards the raw body', async () => {
    const tenants = new TenantContext();
    const { controller, mocks } = await build(
      WhatsAppWebhookController,
      [VerifyWhatsAppWebhookUseCase, HandleWhatsAppStatusWebhookUseCase],
      [{ provide: TenantContext, useValue: tenants }],
    );
    const tenant = { id: 1, slug: 'colegio-a', name: 'A', status: 'active' as const, databaseName: 'x' };
    const rawBody = Buffer.from('{}');

    await tenants.run(tenant, () => controller.subscribe('colegio-a', 'subscribe', 'tok', '42'));
    expect(mocks(VerifyWhatsAppWebhookUseCase)).toHaveBeenCalledWith({
      mode: 'subscribe',
      token: 'tok',
      challenge: '42',
    });
    await tenants.run(tenant, () => controller.receive('colegio-a', { rawBody } as never, 'sha256=x'));
    expect(mocks(HandleWhatsAppStatusWebhookUseCase)).toHaveBeenCalledWith({ rawBody, signature: 'sha256=x' });
    expect(() => tenants.run(tenant, () => controller.receive('colegio-b', { rawBody } as never, 'sha256=x'))).toThrow(
      'El webhook no corresponde a este colegio.',
    );
  });

  it('NotificationsController scopes everything to the actor', async () => {
    const { controller, mocks } = await build(NotificationsController, [
      ListMyNotificationsUseCase,
      MarkNotificationReadUseCase,
      MarkAllNotificationsReadUseCase,
      CreateNotificationsUseCase,
    ]);
    await controller.mine(me, query(MyNotificationsQueryDto, { unreadOnly: true }));
    expect(mocks(ListMyNotificationsUseCase)).toHaveBeenCalledWith({
      userId: 1,
      unreadOnly: true,
      page: { page: 1, limit: 20 },
    });
    await controller.read(me, 4);
    expect(mocks(MarkNotificationReadUseCase)).toHaveBeenCalledWith({ userId: 1, notificationId: 4 });
    await controller.readAll(me);
    expect(mocks(MarkAllNotificationsReadUseCase)).toHaveBeenCalledWith(1);
    await controller.send({ userIds: [2], title: 'T', message: 'M' });
    expect(mocks(CreateNotificationsUseCase)).toHaveBeenCalledWith({
      userIds: [2],
      title: 'T',
      message: 'M',
      type: undefined,
    });
  });

  it('AiAssistantController delegates chat, history and monitor', async () => {
    const { controller, mocks } = await build(AiAssistantController, [
      AskAssistantUseCase,
      ListMyChatHistoryUseCase,
      ListChatLogsUseCase,
    ]);
    const student = actor({ role: Role.STUDENT });
    await controller.chat(student, { message: 'hola' });
    expect(mocks(AskAssistantUseCase)).toHaveBeenCalledWith({ actor: student, message: 'hola' });
    await controller.history(student, query(PaginationQueryDto));
    expect(mocks(ListMyChatHistoryUseCase)).toHaveBeenCalledWith({ userId: 1, page: { page: 1, limit: 20 } });
    await controller.monitor(query(ChatLogsQueryDto, { role: 'student', from: '2026-03-01' }));
    expect(mocks(ListChatLogsUseCase)).toHaveBeenCalledWith({
      criteria: { role: 'student', from: '2026-03-01', to: undefined, search: undefined },
      page: { page: 1, limit: 20 },
    });
  });

  it('MarketingController delegates catalog, generation and history', async () => {
    const { controller, mocks } = await build(MarketingController, [
      ListMarketingTypesUseCase,
      GenerateMarketingContentUseCase,
      ListMyMarketingGenerationsUseCase,
    ]);
    await controller.listTypes();
    expect(mocks(ListMarketingTypesUseCase)).toHaveBeenCalled();
    await controller.create(me, { type: 'email', context: 'Campaña de matrículas' });
    expect(mocks(GenerateMarketingContentUseCase)).toHaveBeenCalledWith({
      actor: me,
      type: 'email',
      context: 'Campaña de matrículas',
    });
    await controller.list(me, query(MarketingHistoryQueryDto, { type: 'email', page: 1, limit: 10 }));
    expect(mocks(ListMyMarketingGenerationsUseCase)).toHaveBeenCalledWith({
      userId: 1,
      type: 'email',
      date: undefined,
      search: undefined,
      page: { page: 1, limit: 10 },
    });
  });
});
