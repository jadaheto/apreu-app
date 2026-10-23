import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notifications/notification.repository.js';
import { type NotificationView, toNotificationView } from '../views.js';

export interface ListMyNotificationsInput {
  userId: number;
  unreadOnly: boolean;
  page: PageRequest;
}

export interface MyNotifications extends Paginated<NotificationView> {
  /** Unread notifications of the user (bell badge). */
  unread: number;
}

/** Notifications of the signed-in user, newest first (legacy `includes/sidebar.php`). */
@Injectable()
export class ListMyNotificationsUseCase implements UseCase<ListMyNotificationsInput, MyNotifications> {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository) {}

  async execute({ userId, unreadOnly, page }: ListMyNotificationsInput): Promise<MyNotifications> {
    const [list, unread] = await Promise.all([
      this.notifications.listForUser(userId, unreadOnly, page),
      this.notifications.countUnread(userId),
    ]);
    return { ...mapPage(list, toNotificationView), unread };
  }
}
