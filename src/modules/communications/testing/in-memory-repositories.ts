import { toOffset, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { ChatExchangeRepository, ChatLogCriteria, ChatLogRecord } from '../domain/ai/chat-exchange.repository.js';
import type { ChatExchange } from '../domain/ai/chat-exchange.js';
import type { MarketingCriteria, MarketingGenerationRepository } from '../domain/ai/marketing-generation.repository.js';
import type { MarketingGeneration } from '../domain/ai/marketing-generation.js';
import type {
  EmailKpis,
  EmailLogCriteria,
  EmailLogRecord,
  EmailLogRepository,
} from '../domain/email/email-log.repository.js';
import type { EmailLog } from '../domain/email/email-log.js';
import type { NotificationRepository } from '../domain/notifications/notification.repository.js';
import type { Notification } from '../domain/notifications/notification.js';
import type {
  WhatsAppKpis,
  WhatsAppLogCriteria,
  WhatsAppLogRecord,
  WhatsAppLogRepository,
} from '../domain/whatsapp/whatsapp-log.repository.js';
import type { WhatsAppLog } from '../domain/whatsapp/whatsapp-log.js';
import type { WhatsAppTemplateRepository } from '../domain/whatsapp/whatsapp-template.repository.js';
import type { TemplateStatus, WhatsAppTemplate } from '../domain/whatsapp/whatsapp-template.js';

const paginate = <T>(items: T[], page: PageRequest): Paginated<T> => {
  const offset = toOffset(page);
  return { items: items.slice(offset, offset + page.limit), total: items.length, page: page.page, limit: page.limit };
};

const newestFirst = <T extends { id: number | null }>(items: T[]): T[] =>
  [...items].sort((a, b) => (b.id as number) - (a.id as number));

export class InMemoryEmailLogRepository implements EmailLogRepository {
  readonly store = new InMemoryStore<EmailLog>();

  async save(log: EmailLog): Promise<void> {
    this.store.save(log);
  }

  async search(criteria: EmailLogCriteria, page: PageRequest): Promise<Paginated<EmailLogRecord>> {
    const matches = newestFirst(this.store.all())
      .filter((log) => !criteria.type || log.type === criteria.type)
      .filter((log) => !criteria.status || log.status === criteria.status)
      .filter((log) => !criteria.search || `${log.toEmail} ${log.subject}`.includes(criteria.search))
      .map((log) => ({ log, sentByName: log.createdBy ? `Usuario ${log.createdBy}` : null }));
    return paginate(matches, page);
  }

  async kpis(): Promise<EmailKpis> {
    const all = this.store.all();
    const count = (predicate: (log: EmailLog) => boolean) => all.filter(predicate).length;
    return {
      total: all.length,
      notices: count((log) => log.type === 'aviso'),
      billing: count((log) => log.type === 'factura_cobro'),
      dian: count((log) => log.type === 'factura_dian'),
      failed: count((log) => log.status === 'failed'),
    };
  }
}

export class InMemoryWhatsAppLogRepository implements WhatsAppLogRepository {
  readonly store = new InMemoryStore<WhatsAppLog>();

  async save(log: WhatsAppLog): Promise<void> {
    this.store.save(log);
  }

  async findByMessageId(messageId: string): Promise<WhatsAppLog | null> {
    return this.store.all().find((log) => log.waMessageId === messageId) ?? null;
  }

  async search(criteria: WhatsAppLogCriteria, page: PageRequest): Promise<Paginated<WhatsAppLogRecord>> {
    const matches = newestFirst(this.store.all())
      .filter((log) => !criteria.status || log.status === criteria.status)
      .filter((log) => !criteria.search || log.phone.includes(criteria.search))
      .map((log) => ({ log, studentName: log.studentId ? `Alumno ${log.studentId}` : null }));
    return paginate(matches, page);
  }

  async kpis(): Promise<WhatsAppKpis> {
    const kpis: WhatsAppKpis = { sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const log of this.store.all()) kpis[log.status]++;
    return kpis;
  }
}

export class InMemoryWhatsAppTemplateRepository implements WhatsAppTemplateRepository {
  readonly store = new InMemoryStore<WhatsAppTemplate>();

  async findById(id: number): Promise<WhatsAppTemplate | null> {
    return this.store.get(id);
  }

  async findByName(name: string): Promise<WhatsAppTemplate | null> {
    return this.store.all().find((template) => template.name === name) ?? null;
  }

  async list(status?: TemplateStatus): Promise<WhatsAppTemplate[]> {
    return this.store
      .all()
      .filter((template) => !status || template.status === status)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(template: WhatsAppTemplate): Promise<void> {
    this.store.save(template);
  }

  async delete(id: number): Promise<void> {
    this.store.items.delete(id);
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  readonly store = new InMemoryStore<Notification>();

  async findById(id: number): Promise<Notification | null> {
    return this.store.get(id);
  }

  async listForUser(userId: number, unreadOnly: boolean, page: PageRequest): Promise<Paginated<Notification>> {
    const matches = newestFirst(this.store.all()).filter(
      (notification) => notification.userId === userId && (!unreadOnly || !notification.isRead),
    );
    return paginate(matches, page);
  }

  async countUnread(userId: number): Promise<number> {
    return this.store.all().filter((notification) => notification.userId === userId && !notification.isRead).length;
  }

  async markAllRead(userId: number): Promise<number> {
    const unread = this.store.all().filter((notification) => notification.userId === userId && !notification.isRead);
    unread.forEach((notification) => notification.markAsRead());
    return unread.length;
  }

  async save(notification: Notification): Promise<void> {
    this.store.save(notification);
  }

  async saveMany(notifications: Notification[]): Promise<void> {
    notifications.forEach((notification) => this.store.save(notification));
  }
}

export class InMemoryChatExchangeRepository implements ChatExchangeRepository {
  readonly store = new InMemoryStore<ChatExchange>();

  async save(exchange: ChatExchange): Promise<void> {
    this.store.save(exchange);
  }

  async search(criteria: ChatLogCriteria, page: PageRequest): Promise<Paginated<ChatLogRecord>> {
    const matches = newestFirst(this.store.all())
      .filter((exchange) => criteria.userId === undefined || exchange.userId === criteria.userId)
      .filter((exchange) => !criteria.role || exchange.role === criteria.role)
      .filter((exchange) => !criteria.search || exchange.userMessage.includes(criteria.search))
      .map((exchange) => ({ exchange, userName: `Usuario ${exchange.userId}`, userEmail: null }));
    return paginate(matches, page);
  }
}

export class InMemoryMarketingGenerationRepository implements MarketingGenerationRepository {
  readonly store = new InMemoryStore<MarketingGeneration>();

  async save(generation: MarketingGeneration): Promise<void> {
    this.store.save(generation);
  }

  async search(criteria: MarketingCriteria, page: PageRequest): Promise<Paginated<MarketingGeneration>> {
    const matches = newestFirst(this.store.all())
      .filter((generation) => generation.userId === criteria.userId)
      .filter((generation) => !criteria.type || generation.type === criteria.type)
      .filter((generation) => !criteria.search || generation.contextInput.includes(criteria.search));
    return paginate(matches, page);
  }
}
