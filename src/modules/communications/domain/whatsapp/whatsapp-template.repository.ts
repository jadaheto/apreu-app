import type { TemplateStatus, WhatsAppTemplate } from './whatsapp-template.js';

/** Output port for `whatsapp_templates`. */
export interface WhatsAppTemplateRepository {
  findById(id: number): Promise<WhatsAppTemplate | null>;
  findByName(name: string): Promise<WhatsAppTemplate | null>;
  /** Ordered by name; optionally filtered by status. */
  list(status?: TemplateStatus): Promise<WhatsAppTemplate[]>;
  save(template: WhatsAppTemplate): Promise<void>;
  delete(id: number): Promise<void>;
}

export const WHATSAPP_TEMPLATE_REPOSITORY = Symbol('WhatsAppTemplateRepository');
