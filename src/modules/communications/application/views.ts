import type { ChatLogRecord } from '../domain/ai/chat-exchange.repository.js';
import type { ChatExchange } from '../domain/ai/chat-exchange.js';
import type { MarketingGeneration, MarketingType } from '../domain/ai/marketing-generation.js';
import type { EmailLogRecord } from '../domain/email/email-log.repository.js';
import type { EmailStatus, EmailType } from '../domain/email/email-log.js';
import type { Notification, NotificationType } from '../domain/notifications/notification.js';
import type { WhatsAppLogRecord } from '../domain/whatsapp/whatsapp-log.repository.js';
import type { WhatsAppStatus } from '../domain/whatsapp/whatsapp-log.js';
import type {
  HeaderType,
  TemplateButton,
  TemplateCategory,
  TemplateStatus,
  WhatsAppTemplate,
} from '../domain/whatsapp/whatsapp-template.js';

/** Read models returned by the use cases to the HTTP layer. */

/** Totals of a bulk delivery. */
export interface DeliverySummary {
  total: number;
  sent: number;
  failed: number;
  /** Recipients without the contact data required by the channel. */
  skipped: number;
  failures: { to: string; error: string }[];
}

export interface EmailLogView {
  id: number;
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyPreview: string | null;
  type: EmailType;
  status: EmailStatus;
  errorMessage: string | null;
  sentBy: number | null;
  sentByName: string | null;
  createdAt: Date | null;
}

export const toEmailLogView = ({ log, sentByName }: EmailLogRecord): EmailLogView => ({
  id: log.id as number,
  toEmail: log.toEmail,
  toName: log.toName,
  subject: log.subject,
  bodyPreview: log.bodyPreview,
  type: log.type,
  status: log.status,
  errorMessage: log.errorMessage,
  sentBy: log.createdBy,
  sentByName,
  createdAt: log.createdAt,
});

export interface WhatsAppLogView {
  id: number;
  studentId: number | null;
  studentName: string | null;
  templateName: string | null;
  phone: string;
  status: WhatsAppStatus;
  waMessageId: string | null;
  response: string | null;
  createdAt: Date | null;
}

export const toWhatsAppLogView = ({ log, studentName }: WhatsAppLogRecord): WhatsAppLogView => ({
  id: log.id as number,
  studentId: log.studentId,
  studentName,
  templateName: log.templateName,
  phone: log.phone,
  status: log.status,
  waMessageId: log.waMessageId,
  response: log.response,
  createdAt: log.createdAt,
});

export interface WhatsAppTemplateView {
  id: number;
  name: string;
  metaTemplateId: string | null;
  language: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
  placeholderCount: number;
  status: TemplateStatus;
  headerType: HeaderType;
  headerText: string | null;
  headerImageUrl: string | null;
  footerText: string | null;
  buttons: TemplateButton[];
  createdAt: Date | null;
}

export const toWhatsAppTemplateView = (template: WhatsAppTemplate): WhatsAppTemplateView => ({
  id: template.id as number,
  name: template.name,
  metaTemplateId: template.metaTemplateId,
  language: template.language,
  category: template.category,
  body: template.body,
  variables: [...template.variables],
  placeholderCount: template.placeholderCount,
  status: template.status,
  headerType: template.headerType,
  headerText: template.headerText,
  headerImageUrl: template.headerImageUrl,
  footerText: template.footerText,
  buttons: [...template.buttons],
  createdAt: template.createdAt,
});

export interface NotificationView {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date | null;
}

export const toNotificationView = (notification: Notification): NotificationView => ({
  id: notification.id as number,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  isRead: notification.isRead,
  createdAt: notification.createdAt,
});

export interface ChatExchangeView {
  id: number;
  role: string;
  userMessage: string;
  aiResponse: string | null;
  createdAt: Date | null;
}

export const toChatExchangeView = (exchange: ChatExchange): ChatExchangeView => ({
  id: exchange.id as number,
  role: exchange.role,
  userMessage: exchange.userMessage,
  aiResponse: exchange.aiResponse,
  createdAt: exchange.createdAt,
});

export interface ChatLogView extends ChatExchangeView {
  userId: number;
  /** `null` when the user was deleted. */
  userName: string | null;
  userEmail: string | null;
}

export const toChatLogView = ({ exchange, userName, userEmail }: ChatLogRecord): ChatLogView => ({
  ...toChatExchangeView(exchange),
  userId: exchange.userId,
  userName,
  userEmail,
});

export interface MarketingGenerationView {
  id: number;
  type: MarketingType;
  contextInput: string;
  crmData: Record<string, unknown>;
  aiResponse: string | null;
  createdAt: Date | null;
}

export const toMarketingGenerationView = (generation: MarketingGeneration): MarketingGenerationView => ({
  id: generation.id as number,
  type: generation.type,
  contextInput: generation.contextInput,
  crmData: { ...generation.crmData },
  aiResponse: generation.aiResponse,
  createdAt: generation.createdAt,
});
