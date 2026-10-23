import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { EmailStatus, EmailType } from '../../domain/email/email-log.js';
import type { NotificationType } from '../../domain/notifications/notification.js';
import type { WhatsAppStatus } from '../../domain/whatsapp/whatsapp-log.js';
import type { HeaderType, TemplateCategory, TemplateStatus } from '../../domain/whatsapp/whatsapp-template.js';

/** Mapping of `email_log`. */
@Entity({ name: 'email_log' })
export class EmailLogOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'to_email', type: 'varchar', length: 200 })
  toEmail: string;

  @Column({ name: 'to_name', type: 'varchar', length: 200, nullable: true })
  toName: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ name: 'body_preview', type: 'varchar', length: 500, nullable: true })
  bodyPreview: string | null;

  @Column({ type: 'varchar', length: 20, default: 'aviso' })
  type: EmailType;

  @Column({ type: 'varchar', length: 10, default: 'sent' })
  status: EmailStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `whatsapp_log`. */
@Entity({ name: 'whatsapp_log' })
export class WhatsAppLogOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer', nullable: true })
  studentId: number | null;

  @Column({ name: 'template_name', type: 'varchar', length: 100, nullable: true })
  templateName: string | null;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 10, default: 'sent' })
  status: WhatsAppStatus;

  @Column({ name: 'wa_message_id', type: 'varchar', length: 100, nullable: true })
  waMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `whatsapp_templates`. */
@Entity({ name: 'whatsapp_templates' })
export class WhatsAppTemplateOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'template_id', type: 'varchar', length: 100, nullable: true })
  templateId: string | null;

  @Column({ type: 'varchar', length: 10, default: 'es_MX' })
  language: string;

  @Column({ type: 'varchar', length: 20, default: 'utility' })
  category: TemplateCategory;

  @Column({ name: 'body_template', type: 'text' })
  bodyTemplate: string;

  /** JSON array of variable labels. */
  /** JSON array of variable labels (legacy: comma separated text). */
  @Column({ type: 'jsonb', nullable: true })
  variables: unknown;

  @Column({ type: 'varchar', length: 10, default: 'active' })
  status: TemplateStatus;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'header_type', type: 'varchar', length: 10, default: 'none' })
  headerType: HeaderType;

  @Column({ name: 'header_text', type: 'varchar', length: 60, nullable: true })
  headerText: string | null;

  @Column({ name: 'header_image_url', type: 'text', nullable: true })
  headerImageUrl: string | null;

  @Column({ name: 'footer_text', type: 'varchar', length: 60, nullable: true })
  footerText: string | null;

  /** JSON array of buttons. */
  @Column({ type: 'jsonb', nullable: true })
  buttons: unknown;
}

/** Mapping of `notifications`. */
@Entity({ name: 'notifications' })
export class NotificationOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 10, default: 'info' })
  type: NotificationType;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `ai_chat_logs`. */
@Entity({ name: 'ai_chat_logs' })
export class ChatLogOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 30, default: 'admin' })
  role: string;

  @Column({ name: 'user_message', type: 'text' })
  userMessage: string;

  @Column({ name: 'ai_response', type: 'text', nullable: true })
  aiResponse: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `ai_marketing_campaigns`. */
@Entity({ name: 'ai_marketing_campaigns' })
export class MarketingCampaignOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'campaign_type', type: 'varchar', length: 50 })
  campaignType: string;

  @Column({ name: 'context_input', type: 'text', nullable: true })
  contextInput: string | null;

  /** JSON object with the CRM figures used. */
  @Column({ name: 'crm_data_used', type: 'jsonb', nullable: true })
  crmDataUsed: Record<string, unknown> | null;

  @Column({ name: 'ai_response', type: 'text', nullable: true })
  aiResponse: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
