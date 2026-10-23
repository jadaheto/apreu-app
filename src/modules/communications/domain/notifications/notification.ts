import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MAX_NOTIFICATION_MESSAGE = 2000;

export interface NotificationProps {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date | null;
}

export interface CreateNotificationProps {
  userId: number;
  title: string;
  message: string;
  type?: NotificationType;
}

/**
 * In-app notification shown in the top bar bell (`notifications`, legacy
 * `includes/sidebar.php`). Belongs to exactly one user, who is the only one
 * allowed to read or mark it.
 */
export class Notification extends Entity<NotificationProps> {
  private constructor(id: EntityId, props: NotificationProps) {
    super(id, props);
  }

  static create(input: CreateNotificationProps, at: Date): Notification {
    const title = input.title?.trim();
    const message = input.message?.trim();
    Guard.againstEmpty(title, 'título');
    Guard.againstMaxLength(title, 200, 'título');
    Guard.againstEmpty(message, 'mensaje');
    Guard.againstMaxLength(message, MAX_NOTIFICATION_MESSAGE, 'mensaje');
    const type = input.type ?? 'info';
    Guard.oneOf(type, NOTIFICATION_TYPES, 'tipo');
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
      throw new BusinessRuleViolationError('La notificación debe tener un usuario destinatario.', 'REQUIRED_FIELD');
    }
    return new Notification(null, { userId: input.userId, title, message, type, isRead: false, createdAt: at });
  }

  static restore(id: number, props: NotificationProps): Notification {
    return new Notification(id, { ...props });
  }

  markAsRead(): void {
    this.props.isRead = true;
  }

  belongsTo(userId: number): boolean {
    return this.props.userId === userId;
  }

  get userId(): number {
    return this.props.userId;
  }
  get title(): string {
    return this.props.title;
  }
  get message(): string {
    return this.props.message;
  }
  get type(): NotificationType {
    return this.props.type;
  }
  get isRead(): boolean {
    return this.props.isRead;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
