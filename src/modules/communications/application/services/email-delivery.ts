import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { EmailAttachment } from '../../domain/email/email-attachment.js';
import { EmailLog, type EmailType } from '../../domain/email/email-log.js';
import { EMAIL_LOG_REPOSITORY, type EmailLogRepository } from '../../domain/email/email-log.repository.js';
import type { Recipient } from '../../domain/email/recipient.js';
import { EMAIL_SENDER, type EmailSenderPort, type SmtpSettings } from '../ports/email-sender.port.js';
import type { RenderedEmail } from './email-templates.js';

/** One e-mail to deliver and log. */
export interface EmailJob {
  to: Recipient;
  content: RenderedEmail;
  attachments?: EmailAttachment[];
  type: EmailType;
  createdBy: number | null;
}

/** Outcome of one delivery. */
export interface EmailOutcome {
  to: string;
  sent: boolean;
  error: string | null;
}

/**
 * Sends one e-mail and records the attempt in `email_log` (RN-COM-02,
 * RN-COM-06). Provider failures never escape: they are logged as `failed`
 * with the error of that same attempt.
 */
@Injectable()
export class EmailDelivery {
  constructor(
    @Inject(EMAIL_SENDER) private readonly sender: EmailSenderPort,
    @Inject(EMAIL_LOG_REPOSITORY) private readonly logs: EmailLogRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async deliver(account: SmtpSettings, job: EmailJob): Promise<EmailOutcome> {
    const entry = {
      toEmail: job.to.email,
      toName: job.to.name,
      subject: job.content.subject,
      body: job.content.html,
      type: job.type,
      createdBy: job.createdBy,
    };
    try {
      await this.sender.send(account, {
        to: job.to,
        subject: job.content.subject,
        html: job.content.html,
        text: job.content.text,
        attachments: job.attachments ?? [],
      });
      await this.logs.save(EmailLog.sent(entry, this.clock.now()));
      return { to: job.to.email, sent: true, error: null };
    } catch (error) {
      const message = (error as Error).message;
      await this.logs.save(EmailLog.failed(entry, message, this.clock.now()));
      return { to: job.to.email, sent: false, error: message };
    }
  }
}
