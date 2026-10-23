import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ExternalServiceError } from '../../../../shared/domain/domain-error.js';
import { CommunicationSettings, type SmtpProfile } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { EmailTemplates } from '../services/email-templates.js';

export interface TestSmtpConnectionInput {
  actor: AuthenticatedActor;
  profile: SmtpProfile;
}

export interface TestSmtpConnectionOutput {
  to: string;
  host: string;
  port: number;
  security: string;
}

/**
 * Sends a test message to the administrator's own address to validate the
 * SMTP configuration (analysis §6.3 `TestSmtpConnection`). No SMTP dialogue
 * is exposed to the client (legacy bug #5, debug output).
 */
@Injectable()
export class TestSmtpConnectionUseCase implements UseCase<TestSmtpConnectionInput, TestSmtpConnectionOutput> {
  constructor(
    private readonly settings: CommunicationSettings,
    private readonly delivery: EmailDelivery,
  ) {}

  async execute({ actor, profile }: TestSmtpConnectionInput): Promise<TestSmtpConnectionOutput> {
    const account = await this.settings.requireSmtp(profile);
    const branding = await this.settings.branding();
    const outcome = await this.delivery.deliver(account, {
      to: { email: actor.email, name: actor.name },
      content: EmailTemplates.smtpTest(branding),
      type: 'otro',
      createdBy: actor.userId,
    });
    if (!outcome.sent) throw new ExternalServiceError('SMTP', outcome.error ?? 'Error desconocido');
    return { to: actor.email, host: account.host, port: account.port, security: account.security };
  }
}
