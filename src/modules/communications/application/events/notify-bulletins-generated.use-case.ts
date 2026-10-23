import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { STUDENT_CONTACTS, type StudentContactsPort } from '../../domain/directory/student-contacts.port.js';
import { uniqueValidRecipients } from '../../domain/email/recipient.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notifications/notification.repository.js';
import { Notification } from '../../domain/notifications/notification.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { EmailTemplates } from '../services/email-templates.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';

export interface BulletinsGeneratedInput {
  periodId: number;
  studentIds: number[];
}

export interface BulletinsGeneratedResult {
  notifications: number;
  emailsSent: number;
  emailsFailed: number;
}

/**
 * Reaction to `academic.bulletins-generated`: notifies each student's portal
 * user in-app and, when SMTP is configured, e-mails the primary guardian.
 * Missing configuration or contact data simply skips that channel.
 */
@Injectable()
export class NotifyBulletinsGeneratedUseCase implements UseCase<BulletinsGeneratedInput, BulletinsGeneratedResult> {
  constructor(
    @Inject(STUDENT_CONTACTS) private readonly students: StudentContactsPort,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly settings: CommunicationSettings,
    private readonly delivery: EmailDelivery,
    private readonly dispatcher: RateLimitedDispatcher,
  ) {}

  async execute({ periodId, studentIds }: BulletinsGeneratedInput): Promise<BulletinsGeneratedResult> {
    if (studentIds.length === 0) return { notifications: 0, emailsSent: 0, emailsFailed: 0 };
    const periodName = (await this.students.periodName(periodId)) ?? `#${periodId}`;
    const contacts = await this.students.contacts(studentIds);

    const now = this.clock.now();
    const notifications = contacts
      .filter((contact) => contact.userId !== null)
      .map((contact) =>
        Notification.create(
          {
            userId: contact.userId as number,
            title: 'Boletín disponible',
            message: `Tu boletín del periodo ${periodName} ya está disponible para descarga.`,
            type: 'success',
          },
          now,
        ),
      );
    if (notifications.length > 0) await this.notifications.saveMany(notifications);

    const account = await this.settings.smtp('general');
    if (!account) return { notifications: notifications.length, emailsSent: 0, emailsFailed: 0 };

    const branding = await this.settings.branding();
    const jobs = contacts.flatMap((contact) =>
      uniqueValidRecipients([{ email: contact.guardianEmail ?? '', name: contact.guardianName }]).map((to) => ({
        to,
        content: EmailTemplates.bulletinAvailable({
          studentName: contact.fullName,
          periodName,
          guardianName: contact.guardianName,
          schoolName: branding.schoolName,
          primaryColor: branding.primaryColor,
        }),
      })),
    );
    const outcomes = await this.dispatcher.run(jobs, await this.settings.deliveryPolicy('email'), (job) =>
      this.delivery.deliver(account, { ...job, type: 'otro', createdBy: null }),
    );
    const sent = outcomes.filter((outcome) => outcome.sent).length;
    return { notifications: notifications.length, emailsSent: sent, emailsFailed: outcomes.length - sent };
  }
}
