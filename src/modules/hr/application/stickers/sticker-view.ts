import type { EmployeeSticker, StickerColor, StickerPriority } from '../../domain/stickers/employee-sticker.js';

export interface StickerView {
  id: number;
  employeeId: number;
  employeeName: string | null;
  title: string;
  content: string | null;
  color: StickerColor;
  priority: StickerPriority;
  isRead: boolean;
  readAt: Date | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: Date | null;
}

export const toStickerView = (
  s: EmployeeSticker,
  employeeName: string | null = null,
  createdByName: string | null = null,
): StickerView => ({
  id: s.id as number,
  employeeId: s.employeeId,
  employeeName,
  title: s.title,
  content: s.content,
  color: s.color,
  priority: s.priority,
  isRead: s.isRead,
  readAt: s.readAt,
  createdBy: s.createdBy,
  createdByName,
  createdAt: s.createdAt,
});
