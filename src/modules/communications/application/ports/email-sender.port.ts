import type { EmailAttachment } from '../../domain/email/email-attachment.js';
import type { Recipient } from '../../domain/email/recipient.js';

/** Transport security of the SMTP connection. */
export type SmtpSecurity = 'ssl' | 'starttls' | 'none';

/** Resolved SMTP account of the tenant. */
export interface SmtpSettings {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

/** One message to a single recipient (RN-COM-02: never several addresses in `To`). */
export interface OutgoingEmail {
  to: Recipient;
  subject: string;
  html: string;
  /** Plain-text alternative. */
  text: string;
  attachments: EmailAttachment[];
}

/**
 * Sends e-mails. Throws `ExternalServiceError` with the provider's message
 * when the server rejects or cannot be reached.
 */
export interface EmailSenderPort {
  send(account: SmtpSettings, message: OutgoingEmail): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EmailSenderPort');
