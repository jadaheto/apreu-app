import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { RECIPIENT_DIRECTORY, type RecipientDirectoryPort } from '../../domain/directory/recipient-directory.port.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notifications/notification.repository.js';
import { Notification, type NotificationType } from '../../domain/notifications/notification.js';

export const MAX_NOTIFICATION_RECIPIENTS = 1000;

export interface CreateNotificationsInput {
  userIds: number[];
  title: string;
  message: string;
  type?: NotificationType;
}

/**
 * Sends an in-app notification to one or more active users. Unknown or
 * inactive users are rejected so a typo never goes unnoticed.
 */
@Injectable()
export class CreateNotificationsUseCase implements UseCase<CreateNotificationsInput, { created: number }> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: CreateNotificationsInput): Promise<{ created: number }> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0 || userIds.length > MAX_NOTIFICATION_RECIPIENTS) {
      throw new BusinessRuleViolationError(
        `Indique entre 1 y ${MAX_NOTIFICATION_RECIPIENTS} usuarios destinatarios.`,
        'INVALID_RECIPIENTS',
      );
    }
    const existing = new Set(await this.directory.existingUserIds(userIds));
    const unknown = userIds.filter((id) => !existing.has(id));
    if (unknown.length > 0) {
      throw new BusinessRuleViolationError('Algunos usuarios no existen o están inactivos.', 'UNKNOWN_USERS', {
        unknown,
      });
    }
    const now = this.clock.now();
    const notifications = userIds.map((userId) =>
      Notification.create({ userId, title: input.title, message: input.message, type: input.type }, now),
    );
    await this.notifications.saveMany(notifications);
    return { created: notifications.length };
  }
}
