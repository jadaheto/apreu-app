import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { Notification } from './notification.js';

/** Output port for `notifications`. */
export interface NotificationRepository {
  findById(id: number): Promise<Notification | null>;
  /** Newest first. */
  listForUser(userId: number, unreadOnly: boolean, page: PageRequest): Promise<Paginated<Notification>>;
  countUnread(userId: number): Promise<number>;
  markAllRead(userId: number): Promise<number>;
  save(notification: Notification): Promise<void>;
  saveMany(notifications: Notification[]): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');
