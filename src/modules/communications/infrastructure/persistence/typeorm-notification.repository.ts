import { Injectable } from '@nestjs/common';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { NotificationRepository } from '../../domain/notifications/notification.repository.js';
import type { Notification } from '../../domain/notifications/notification.js';
import { NotificationMapper } from './mappers.js';
import { NotificationOrmEntity } from './orm-entities.js';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Notification | null> {
    const row = await (await this.db.repository(NotificationOrmEntity)).findOneBy({ id });
    return row ? NotificationMapper.toDomain(row) : null;
  }

  async listForUser(userId: number, unreadOnly: boolean, page: PageRequest): Promise<Paginated<Notification>> {
    const [rows, total] = await (
      await this.db.repository(NotificationOrmEntity)
    ).findAndCount({
      where: unreadOnly ? { userId, isRead: false } : { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: toOffset(page),
      take: page.limit,
    });
    return { items: rows.map(NotificationMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async countUnread(userId: number): Promise<number> {
    return (await this.db.repository(NotificationOrmEntity)).countBy({ userId, isRead: false });
  }

  async markAllRead(userId: number): Promise<number> {
    const result = await (
      await this.db.repository(NotificationOrmEntity)
    ).update({ userId, isRead: false }, { isRead: true });
    return result.affected ?? 0;
  }

  async save(notification: Notification): Promise<void> {
    await this.saveMany([notification]);
  }

  async saveMany(notifications: Notification[]): Promise<void> {
    const saved = await (
      await this.db.repository(NotificationOrmEntity)
    ).save(notifications.map(NotificationMapper.toPersistence));
    notifications.forEach((notification, index) => {
      if (notification.isNew) notification.assignId(saved[index].id);
    });
  }
}
