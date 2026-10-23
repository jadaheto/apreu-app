import { Injectable } from '@nestjs/common';
import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import type { EmailSenderPort, OutgoingEmail, SmtpSettings } from '../../../application/ports/email-sender.port.js';
import { buildMimeMessage } from './mime-message.js';
import { SmtpClient } from './smtp-client.js';

/**
 * {@link EmailSenderPort} over the built-in {@link SmtpClient} (replaces
 * PHPMailer). One SMTP session per message and recipient (RN-COM-02).
 * There is no fallback to an unauthenticated transport (legacy bug #9).
 */
@Injectable()
export class SmtpEmailSender implements EmailSenderPort {
  constructor(private readonly client: SmtpClient) {}

  async send(account: SmtpSettings, message: OutgoingEmail): Promise<void> {
    try {
      const data = buildMimeMessage({
        from: { email: account.fromEmail, name: account.fromName },
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments,
        date: new Date(),
        messageIdDomain: account.fromEmail.split('@')[1] ?? 'apreu.co',
      });
      await this.client.send(account, { from: account.fromEmail, to: message.to.email }, data);
    } catch (error) {
      throw new ExternalServiceError('SMTP', (error as Error).message);
    }
  }
}
