import { ChatExchange } from '../../domain/ai/chat-exchange.js';
import { MarketingGeneration, type MarketingType } from '../../domain/ai/marketing-generation.js';
import { EmailLog } from '../../domain/email/email-log.js';
import { Notification } from '../../domain/notifications/notification.js';
import { WhatsAppLog } from '../../domain/whatsapp/whatsapp-log.js';
import { type TemplateButton, WhatsAppTemplate } from '../../domain/whatsapp/whatsapp-template.js';
import {
  ChatLogOrmEntity,
  EmailLogOrmEntity,
  MarketingCampaignOrmEntity,
  NotificationOrmEntity,
  WhatsAppLogOrmEntity,
  WhatsAppTemplateOrmEntity,
} from './orm-entities.js';

/**
 * `jsonb` values arrive parsed. A JSON string (legacy free text imported as a
 * JSON scalar) is parsed defensively and kept as-is when it is not JSON.
 */
const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/** Legacy `variables` may be a JSON array or a comma separated list. */
const parseVariables = (value: unknown): string[] => {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed.map(String);
  return (typeof parsed === 'string' ? parsed : '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
};

const parseButtons = (value: unknown): TemplateButton[] => {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
};

const parseObject = (value: unknown): Record<string, unknown> => {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
};

export const EmailLogMapper = {
  toDomain(row: EmailLogOrmEntity): EmailLog {
    return EmailLog.restore(row.id, { ...row });
  },
  toPersistence(log: EmailLog): EmailLogOrmEntity {
    return Object.assign(new EmailLogOrmEntity(), {
      ...(log.id !== null && { id: log.id }),
      toEmail: log.toEmail,
      toName: log.toName,
      subject: log.subject,
      bodyPreview: log.bodyPreview,
      type: log.type,
      status: log.status,
      errorMessage: log.errorMessage,
      createdBy: log.createdBy,
      createdAt: log.createdAt,
    });
  },
};

export const WhatsAppLogMapper = {
  toDomain(row: WhatsAppLogOrmEntity): WhatsAppLog {
    return WhatsAppLog.restore(row.id, { ...row });
  },
  toPersistence(log: WhatsAppLog): WhatsAppLogOrmEntity {
    return Object.assign(new WhatsAppLogOrmEntity(), {
      ...(log.id !== null && { id: log.id }),
      studentId: log.studentId,
      templateName: log.templateName,
      phone: log.phone,
      status: log.status,
      waMessageId: log.waMessageId,
      response: log.response,
      createdBy: log.createdBy,
      createdAt: log.createdAt,
    });
  },
};

export const WhatsAppTemplateMapper = {
  toDomain(row: WhatsAppTemplateOrmEntity): WhatsAppTemplate {
    return WhatsAppTemplate.restore(row.id, {
      name: row.name,
      metaTemplateId: row.templateId,
      language: row.language,
      category: row.category,
      body: row.bodyTemplate,
      variables: parseVariables(row.variables),
      status: row.status,
      headerType: row.headerType ?? 'none',
      headerText: row.headerText,
      headerImageUrl: row.headerImageUrl,
      footerText: row.footerText,
      buttons: parseButtons(row.buttons),
      createdAt: row.createdAt,
    });
  },
  toPersistence(template: WhatsAppTemplate): WhatsAppTemplateOrmEntity {
    return Object.assign(new WhatsAppTemplateOrmEntity(), {
      ...(template.id !== null && { id: template.id }),
      name: template.name,
      templateId: template.metaTemplateId,
      language: template.language,
      category: template.category,
      bodyTemplate: template.body,
      variables: [...template.variables],
      status: template.status,
      headerType: template.headerType,
      headerText: template.headerText,
      headerImageUrl: template.headerImageUrl,
      footerText: template.footerText,
      buttons: template.buttons.length > 0 ? [...template.buttons] : null,
    });
  },
};

export const NotificationMapper = {
  toDomain(row: NotificationOrmEntity): Notification {
    return Notification.restore(row.id, { ...row });
  },
  toPersistence(notification: Notification): NotificationOrmEntity {
    return Object.assign(new NotificationOrmEntity(), {
      ...(notification.id !== null && { id: notification.id }),
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });
  },
};

export const ChatExchangeMapper = {
  toDomain(row: ChatLogOrmEntity): ChatExchange {
    return ChatExchange.restore(row.id, { ...row });
  },
  toPersistence(exchange: ChatExchange): ChatLogOrmEntity {
    return Object.assign(new ChatLogOrmEntity(), {
      ...(exchange.id !== null && { id: exchange.id }),
      userId: exchange.userId,
      role: exchange.role,
      userMessage: exchange.userMessage,
      aiResponse: exchange.aiResponse,
      createdAt: exchange.createdAt,
    });
  },
};

export const MarketingGenerationMapper = {
  toDomain(row: MarketingCampaignOrmEntity): MarketingGeneration {
    return MarketingGeneration.restore(row.id, {
      userId: row.userId,
      type: row.campaignType as MarketingType,
      contextInput: row.contextInput ?? '',
      crmData: parseObject(row.crmDataUsed),
      aiResponse: row.aiResponse,
      createdAt: row.createdAt,
    });
  },
  toPersistence(generation: MarketingGeneration): MarketingCampaignOrmEntity {
    return Object.assign(new MarketingCampaignOrmEntity(), {
      ...(generation.id !== null && { id: generation.id }),
      userId: generation.userId,
      campaignType: generation.type,
      contextInput: generation.contextInput,
      crmDataUsed: { ...generation.crmData },
      aiResponse: generation.aiResponse,
      createdAt: generation.createdAt,
    });
  },
};
