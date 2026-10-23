import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import {
  ChatLogOrmEntity,
  EmailLogOrmEntity,
  MarketingCampaignOrmEntity,
  NotificationOrmEntity,
  WhatsAppLogOrmEntity,
  WhatsAppTemplateOrmEntity,
} from './orm-entities.js';

TenantEntityRegistry.register(
  EmailLogOrmEntity,
  WhatsAppLogOrmEntity,
  WhatsAppTemplateOrmEntity,
  NotificationOrmEntity,
  ChatLogOrmEntity,
  MarketingCampaignOrmEntity,
);

export * from './orm-entities.js';
export * from './sql-directory.adapters.js';
export * from './sql-settings-store.js';
export * from './typeorm-chat-exchange.repository.js';
export * from './typeorm-email-log.repository.js';
export * from './typeorm-marketing-generation.repository.js';
export * from './typeorm-notification.repository.js';
export * from './typeorm-whatsapp-log.repository.js';
export * from './typeorm-whatsapp-template.repository.js';
