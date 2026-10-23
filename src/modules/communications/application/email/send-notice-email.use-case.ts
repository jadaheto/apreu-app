import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError, ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { Role } from '../../../../shared/domain/role.js';
import { hasLineBreak, htmlToPlainText } from '../../domain/common/text.js';
import { GROUP_DIRECTORS, type GroupDirectorPort } from '../../domain/directory/group-director.port.js';
import { RECIPIENT_DIRECTORY, type RecipientDirectoryPort } from '../../domain/directory/recipient-directory.port.js';
import { Audience, type AudienceInput } from '../../domain/email/audience.js';
import { toEmailAttachments, type UploadedFile } from '../../domain/email/email-attachment.js';
import { type Recipient, uniqueValidRecipients } from '../../domain/email/recipient.js';
import { HTML_SANITIZER, type HtmlSanitizerPort } from '../ports/html-sanitizer.port.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { EmailTemplates } from '../services/email-templates.js';
import { summarize } from '../services/delivery-summary.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import type { DeliverySummary } from '../views.js';

export interface SendNoticeEmailInput {
  actor: AuthenticatedActor;
  audience: AudienceInput;
  subject: string;
  bodyHtml: string;
  attachments: UploadedFile[];
}

/**
 * Sends a notice e-mail ("aviso") to an audience (legacy `email/compose.php`,
 * RN-COM-02..06).
 *
 * - Subject and body are required; the body is sanitized (bug #5).
 * - Attachments are validated on the server (bug #7).
 * - Teachers may only write to the classroom they direct (analysis §6.4).
 * - One message per distinct recipient, sent in rate-limited batches and
 *   logged in `email_log` (bug #16).
 */
@Injectable()
export class SendNoticeEmailUseCase implements UseCase<SendNoticeEmailInput, DeliverySummary> {
  constructor(
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectoryPort,
    @Inject(GROUP_DIRECTORS) private readonly directors: GroupDirectorPort,
    @Inject(HTML_SANITIZER) private readonly sanitizer: HtmlSanitizerPort,
    private readonly settings: CommunicationSettings,
    private readonly delivery: EmailDelivery,
    private readonly dispatcher: RateLimitedDispatcher,
  ) {}

  async execute(input: SendNoticeEmailInput): Promise<DeliverySummary> {
    const subject = input.subject?.trim() ?? '';
    const safeBody = this.sanitizer.sanitize(input.bodyHtml ?? '');
    if (!subject || (!htmlToPlainText(safeBody) && !/<img\b/i.test(safeBody))) {
      throw new BusinessRuleViolationError('Asunto y mensaje son obligatorios.', 'NOTICE_CONTENT_REQUIRED');
    }
    Guard.againstMaxLength(subject, 255, 'asunto');
    if (hasLineBreak(subject)) {
      throw new BusinessRuleViolationError('El asunto no puede contener saltos de línea.', 'INVALID_SUBJECT');
    }

    const audience = Audience.create(input.audience);
    await this.authorize(input.actor, audience);
    const attachments = toEmailAttachments(input.attachments);
    const account = await this.settings.requireSmtp('general');

    const recipients = uniqueValidRecipients(await this.resolve(audience));
    if (recipients.length === 0) {
      throw new BusinessRuleViolationError('No se encontraron destinatarios válidos.', 'NO_RECIPIENTS');
    }

    const branding = await this.settings.branding();
    const content = EmailTemplates.notice({
      subject,
      safeBodyHtml: safeBody,
      schoolName: branding.schoolName,
      primaryColor: branding.primaryColor,
    });
    const policy = await this.settings.deliveryPolicy('email');
    const outcomes = await this.dispatcher.run(recipients, policy, (to) =>
      this.delivery.deliver(account, { to, content, attachments, type: 'aviso', createdBy: input.actor.userId }),
    );
    return summarize(outcomes, (index) => recipients[index].email);
  }

  private async authorize(actor: AuthenticatedActor, audience: Audience): Promise<void> {
    if (actor.role !== Role.TEACHER) return;
    const ownsClassroom =
      audience.kind === 'by_classroom' &&
      (await this.directors.isActiveDirector(actor.userId, audience.classroomId as number));
    if (!ownsClassroom) {
      throw new ForbiddenError('Como director de grupo solo puede enviar avisos a los acudientes de su grupo.');
    }
  }

  private resolve(audience: Audience): Promise<Recipient[]> | Recipient[] {
    switch (audience.kind) {
      case 'all_parents':
        return this.directory.guardianEmails({});
      case 'by_grade':
        return this.directory.guardianEmails({ gradeId: audience.gradeId as number });
      case 'by_classroom':
        return this.directory.guardianEmails({ classroomId: audience.classroomId as number });
      case 'all_employees':
        return this.directory.activeEmployeeEmails();
      case 'manual':
        return audience.manualEmails.map((email) => ({ email, name: null }));
    }
  }
}
