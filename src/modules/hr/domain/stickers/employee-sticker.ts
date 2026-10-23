import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

export const STICKER_COLORS = ['yellow', 'red', 'green', 'blue', 'purple'] as const;
export type StickerColor = (typeof STICKER_COLORS)[number];

export const STICKER_PRIORITIES = ['normal', 'urgent'] as const;
export type StickerPriority = (typeof STICKER_PRIORITIES)[number];

export interface EmployeeStickerProps {
  employeeId: number;
  title: string;
  content: string | null;
  color: StickerColor;
  priority: StickerPriority;
  isRead: boolean;
  readAt: Date | null;
  createdBy: number | null;
  createdAt: Date | null;
}

export interface NewEmployeeSticker {
  employeeId: number;
  title: string;
  content?: string | null;
  color?: StickerColor;
  priority?: StickerPriority;
  createdBy: number;
}

/**
 * Post-it style note assigned to an employee (`employee_stickers`, owned by
 * HR per ADR-0002; rules from analysis 01 §2.8 and rule 20). It pops up in the
 * employee portal until the recipient marks it as read.
 */
export class EmployeeSticker extends Entity<EmployeeStickerProps> {
  private constructor(id: EntityId, props: EmployeeStickerProps) {
    super(id, props);
  }

  static create(input: NewEmployeeSticker): EmployeeSticker {
    const title = input.title?.trim();
    Guard.againstEmpty(title, 'título');
    Guard.againstMaxLength(title, 150, 'título');
    const content = input.content?.trim() || null;
    Guard.againstMaxLength(content, 2000, 'contenido');
    const color = input.color ?? 'yellow';
    const priority = input.priority ?? 'normal';
    Guard.oneOf(color, STICKER_COLORS, 'color');
    Guard.oneOf(priority, STICKER_PRIORITIES, 'prioridad');
    return new EmployeeSticker(null, {
      employeeId: input.employeeId,
      title,
      content,
      color,
      priority,
      isRead: false,
      readAt: null,
      createdBy: input.createdBy,
      createdAt: null,
    });
  }

  static restore(id: number, props: EmployeeStickerProps): EmployeeSticker {
    return new EmployeeSticker(id, { ...props });
  }

  get employeeId(): number {
    return this.props.employeeId;
  }
  get title(): string {
    return this.props.title;
  }
  get content(): string | null {
    return this.props.content;
  }
  get color(): StickerColor {
    return this.props.color;
  }
  get priority(): StickerPriority {
    return this.props.priority;
  }
  get isRead(): boolean {
    return this.props.isRead;
  }
  get readAt(): Date | null {
    return this.props.readAt;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Idempotent: keeps the first read time. */
  markRead(at: Date): void {
    if (this.props.isRead) return;
    this.props.isRead = true;
    this.props.readAt = at;
  }
}
