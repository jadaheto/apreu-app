import { Module, type OnModuleInit } from '@nestjs/common';
import { AskAssistantUseCase } from './application/ai/ask-assistant.use-case.js';
import { ListChatLogsUseCase, ListMyChatHistoryUseCase } from './application/ai/list-chat-history.use-cases.js';
import {
  GenerateMarketingContentUseCase,
  ListMarketingTypesUseCase,
  ListMyMarketingGenerationsUseCase,
} from './application/ai/marketing.use-cases.js';
import { PreviewBillingNoticesUseCase } from './application/billing/preview-billing-notices.use-case.js';
import { SendBillingNoticesUseCase } from './application/billing/send-billing-notices.use-case.js';
import { GetEmailKpisUseCase } from './application/email/get-email-kpis.use-case.js';
import { ListEmailLogsUseCase } from './application/email/list-email-logs.use-case.js';
import { SendNoticeEmailUseCase } from './application/email/send-notice-email.use-case.js';
import { TestSmtpConnectionUseCase } from './application/email/test-smtp-connection.use-case.js';
import { UploadEmailImageUseCase } from './application/email/upload-email-image.use-case.js';
import { NotifyBulletinsGeneratedUseCase } from './application/events/notify-bulletins-generated.use-case.js';
import { SendInvoiceEmailUseCase } from './application/events/send-invoice-email.use-case.js';
import { CreateNotificationsUseCase } from './application/notifications/create-notifications.use-case.js';
import { ListMyNotificationsUseCase } from './application/notifications/list-my-notifications.use-case.js';
import {
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from './application/notifications/mark-notification-read.use-case.js';
import { AI_ASSISTANT, MARKETING_GENERATOR } from './application/ports/ai-gateway.port.js';
import { DELAY } from './application/ports/delay.port.js';
import { EMAIL_SENDER } from './application/ports/email-sender.port.js';
import { FILE_STORAGE } from './application/ports/file-storage.port.js';
import { HTML_SANITIZER } from './application/ports/html-sanitizer.port.js';
import { SETTINGS_STORE } from './application/ports/settings-store.port.js';
import { WEBHOOK_SIGNATURE } from './application/ports/webhook-signature.port.js';
import { WHATSAPP_GATEWAY } from './application/ports/whatsapp-gateway.port.js';
import { CommunicationSettings } from './application/services/communication-settings.js';
import { EmailDelivery } from './application/services/email-delivery.js';
import { RateLimitedDispatcher } from './application/services/rate-limited-dispatcher.js';
import { WhatsAppDelivery } from './application/services/whatsapp-delivery.js';
import { GetWhatsAppKpisUseCase } from './application/whatsapp/get-whatsapp-kpis.use-case.js';
import { ListWhatsAppLogsUseCase } from './application/whatsapp/list-whatsapp-logs.use-case.js';
import {
  CreateWhatsAppTemplateUseCase,
  DeleteWhatsAppTemplateUseCase,
  GetWhatsAppTemplateUseCase,
  ListWhatsAppTemplatesUseCase,
  UpdateWhatsAppTemplateUseCase,
} from './application/whatsapp/manage-whatsapp-templates.use-cases.js';
import { NotifyEventUseCase } from './application/whatsapp/notify-event.use-case.js';
import { SendPaymentConfirmationUseCase } from './application/whatsapp/send-payment-confirmation.use-case.js';
import { SendSingleWhatsAppUseCase } from './application/whatsapp/send-single-whatsapp.use-case.js';
import {
  HandleWhatsAppStatusWebhookUseCase,
  VerifyWhatsAppWebhookUseCase,
} from './application/whatsapp/whatsapp-webhook.use-cases.js';
import { CHAT_EXCHANGE_REPOSITORY } from './domain/ai/chat-exchange.repository.js';
import { MARKETING_GENERATION_REPOSITORY } from './domain/ai/marketing-generation.repository.js';
import { AI_CONTEXT } from './domain/directory/ai-context.port.js';
import { BILLING_CHARGES } from './domain/directory/billing-charges.port.js';
import { GROUP_DIRECTORS } from './domain/directory/group-director.port.js';
import { INVOICE_LOOKUP } from './domain/directory/invoice-lookup.port.js';
import { PAYMENT_LOOKUP } from './domain/directory/payment-lookup.port.js';
import { RECIPIENT_DIRECTORY } from './domain/directory/recipient-directory.port.js';
import { STUDENT_CONTACTS } from './domain/directory/student-contacts.port.js';
import { EMAIL_LOG_REPOSITORY } from './domain/email/email-log.repository.js';
import { NOTIFICATION_REPOSITORY } from './domain/notifications/notification.repository.js';
import { WHATSAPP_LOG_REPOSITORY } from './domain/whatsapp/whatsapp-log.repository.js';
import { WHATSAPP_TEMPLATE_REPOSITORY } from './domain/whatsapp/whatsapp-template.repository.js';
import { AllowlistHtmlSanitizer } from './infrastructure/adapters/allowlist-html-sanitizer.js';
import { LocalFileStorage } from './infrastructure/adapters/local-file-storage.js';
import { N8nWebhookClient } from './infrastructure/adapters/n8n/n8n-webhook.client.js';
import { SmtpClient } from './infrastructure/adapters/smtp/smtp-client.js';
import { SmtpEmailSender } from './infrastructure/adapters/smtp/smtp-email-sender.js';
import { TimerDelay } from './infrastructure/adapters/timer-delay.js';
import { HmacWebhookSignature } from './infrastructure/adapters/whatsapp/hmac-webhook-signature.js';
import { MetaCloudApiGateway } from './infrastructure/adapters/whatsapp/meta-cloud-api.gateway.js';
import { CommunicationsEventSubscriber } from './infrastructure/events/communications-event.subscriber.js';
import { AiAssistantController } from './infrastructure/http/ai-assistant.controller.js';
import { BillingNoticesController } from './infrastructure/http/billing-notices.controller.js';
import { EmailController } from './infrastructure/http/email.controller.js';
import { MarketingController } from './infrastructure/http/marketing.controller.js';
import { NotificationsController } from './infrastructure/http/notifications.controller.js';
import { WhatsAppTemplatesController } from './infrastructure/http/whatsapp-templates.controller.js';
import { WhatsAppWebhookController } from './infrastructure/http/whatsapp-webhook.controller.js';
import { WhatsAppController } from './infrastructure/http/whatsapp.controller.js';
import {
  SqlAiContext,
  SqlBillingCharges,
  SqlGroupDirectors,
  SqlInvoiceLookup,
  SqlPaymentLookup,
  SqlRecipientDirectory,
  SqlSettingsStore,
  SqlStudentContacts,
  TypeOrmChatExchangeRepository,
  TypeOrmEmailLogRepository,
  TypeOrmMarketingGenerationRepository,
  TypeOrmNotificationRepository,
  TypeOrmWhatsAppLogRepository,
  TypeOrmWhatsAppTemplateRepository,
} from './infrastructure/persistence/index.js';

const n8n = new N8nWebhookClient();

/**
 * Communications context: e-mail (notices, billing notices, invoices),
 * WhatsApp Cloud API, in-app notifications, AI assistant and marketing AI.
 * Composition root binding the ports to their adapters and registering the
 * integration-event subscriptions.
 */
@Module({
  controllers: [
    EmailController,
    BillingNoticesController,
    WhatsAppController,
    WhatsAppTemplatesController,
    WhatsAppWebhookController,
    NotificationsController,
    AiAssistantController,
    MarketingController,
  ],
  providers: [
    // Application services
    CommunicationSettings,
    EmailDelivery,
    WhatsAppDelivery,
    RateLimitedDispatcher,
    // Use cases
    SendNoticeEmailUseCase,
    GetEmailKpisUseCase,
    ListEmailLogsUseCase,
    TestSmtpConnectionUseCase,
    UploadEmailImageUseCase,
    PreviewBillingNoticesUseCase,
    SendBillingNoticesUseCase,
    SendSingleWhatsAppUseCase,
    NotifyEventUseCase,
    SendPaymentConfirmationUseCase,
    GetWhatsAppKpisUseCase,
    ListWhatsAppLogsUseCase,
    ListWhatsAppTemplatesUseCase,
    GetWhatsAppTemplateUseCase,
    CreateWhatsAppTemplateUseCase,
    UpdateWhatsAppTemplateUseCase,
    DeleteWhatsAppTemplateUseCase,
    VerifyWhatsAppWebhookUseCase,
    HandleWhatsAppStatusWebhookUseCase,
    ListMyNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    CreateNotificationsUseCase,
    AskAssistantUseCase,
    ListMyChatHistoryUseCase,
    ListChatLogsUseCase,
    ListMarketingTypesUseCase,
    GenerateMarketingContentUseCase,
    ListMyMarketingGenerationsUseCase,
    SendInvoiceEmailUseCase,
    NotifyBulletinsGeneratedUseCase,
    CommunicationsEventSubscriber,
    // Repositories
    { provide: EMAIL_LOG_REPOSITORY, useClass: TypeOrmEmailLogRepository },
    { provide: WHATSAPP_LOG_REPOSITORY, useClass: TypeOrmWhatsAppLogRepository },
    { provide: WHATSAPP_TEMPLATE_REPOSITORY, useClass: TypeOrmWhatsAppTemplateRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
    { provide: CHAT_EXCHANGE_REPOSITORY, useClass: TypeOrmChatExchangeRepository },
    { provide: MARKETING_GENERATION_REPOSITORY, useClass: TypeOrmMarketingGenerationRepository },
    // Read-only views of other contexts
    { provide: SETTINGS_STORE, useClass: SqlSettingsStore },
    { provide: RECIPIENT_DIRECTORY, useClass: SqlRecipientDirectory },
    { provide: GROUP_DIRECTORS, useClass: SqlGroupDirectors },
    { provide: BILLING_CHARGES, useClass: SqlBillingCharges },
    { provide: PAYMENT_LOOKUP, useClass: SqlPaymentLookup },
    { provide: INVOICE_LOOKUP, useClass: SqlInvoiceLookup },
    { provide: STUDENT_CONTACTS, useClass: SqlStudentContacts },
    { provide: AI_CONTEXT, useClass: SqlAiContext },
    // External integrations
    { provide: SmtpClient, useFactory: () => new SmtpClient() },
    { provide: EMAIL_SENDER, useClass: SmtpEmailSender },
    { provide: WHATSAPP_GATEWAY, useFactory: () => new MetaCloudApiGateway() },
    { provide: WEBHOOK_SIGNATURE, useClass: HmacWebhookSignature },
    { provide: AI_ASSISTANT, useValue: n8n },
    { provide: MARKETING_GENERATOR, useValue: n8n },
    { provide: HTML_SANITIZER, useClass: AllowlistHtmlSanitizer },
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
    { provide: DELAY, useClass: TimerDelay },
  ],
})
export class CommunicationsModule implements OnModuleInit {
  constructor(private readonly subscriber: CommunicationsEventSubscriber) {}

  onModuleInit(): void {
    this.subscriber.register();
  }
}
