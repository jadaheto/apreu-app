import type { ComposedTemplateMessage } from '../../domain/whatsapp/whatsapp-template.js';

/** Credentials of the WhatsApp Cloud API number. */
export interface WhatsAppCredentials {
  token: string;
  phoneNumberId: string;
}

/**
 * Sends template messages through Meta's WhatsApp Cloud API. Throws
 * `ExternalServiceError` with Meta's error message on failure.
 */
export interface WhatsAppGatewayPort {
  /** @returns the `wamid` assigned by Meta. */
  sendTemplate(credentials: WhatsAppCredentials, to: string, message: ComposedTemplateMessage): Promise<string>;
}

export const WHATSAPP_GATEWAY = Symbol('WhatsAppGatewayPort');
