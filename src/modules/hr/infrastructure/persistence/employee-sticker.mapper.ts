import { EmployeeSticker, STICKER_COLORS, STICKER_PRIORITIES } from '../../domain/stickers/employee-sticker.js';
import { EmployeeStickerOrmEntity } from './employee-sticker.orm-entity.js';
import { enumValue } from './enum-value.js';

/** Translates between `employee_stickers` rows and {@link EmployeeSticker}. */
export const EmployeeStickerMapper = {
  toDomain(row: EmployeeStickerOrmEntity): EmployeeSticker {
    return EmployeeSticker.restore(row.id, {
      employeeId: row.employeeId,
      title: row.title,
      content: row.content,
      color: enumValue(row.color, STICKER_COLORS, 'yellow'),
      priority: enumValue(row.priority, STICKER_PRIORITIES, 'normal'),
      isRead: row.isRead,
      readAt: row.readAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  },

  toPersistence(s: EmployeeSticker): EmployeeStickerOrmEntity {
    const row = new EmployeeStickerOrmEntity();
    if (s.id !== null) row.id = s.id;
    Object.assign(row, {
      employeeId: s.employeeId,
      title: s.title,
      content: s.content,
      color: s.color,
      priority: s.priority,
      isRead: s.isRead,
      readAt: s.readAt,
      createdBy: s.createdBy,
    });
    return row;
  },
};
