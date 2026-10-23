import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notifications/notification.repository.js';
import { type NotificationView, toNotificationView } from '../views.js';

/**
 * Marks one of the user's notifications as read. Notifications of other
 * users are reported as not found (no IDOR, no existence disclosure).
 */
@Injectable()
export class MarkNotificationReadUseCase implements UseCase<
  { userId: number; notificationId: number },
  NotificationView
> {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository) {}

  async execute({ userId, notificationId }: { userId: number; notificationId: number }): Promise<NotificationView> {
    const notification = await this.notifications.findById(notificationId);
    if (!notification || !notification.belongsTo(userId)) throw new NotFoundError('Notificación', notificationId);
    if (!notification.isRead) {
      notification.markAsRead();
      await this.notifications.save(notification);
    }
    return toNotificationView(notification);
  }
}

/** Marks every notification of the user as read. */
@Injectable()
export class MarkAllNotificationsReadUseCase implements UseCase<number, { updated: number }> {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository) {}

  async execute(userId: number): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(userId) };
  }
}
