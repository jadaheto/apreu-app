import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import type { EmployeeSticker } from './employee-sticker.js';

export const STICKER_FILTERS = ['all', 'unread', 'urgent'] as const;
export type StickerFilter = (typeof STICKER_FILTERS)[number];

/**
 * Visibility scope. `null` = every sticker (admin/HR). Otherwise the stickers
 * addressed to `employeeId` or created by `userId` (fixes the legacy leak S14
 * where a user without employee record saw everything).
 */
export interface StickerScope {
  employeeId: number | null;
  userId: number;
}

export interface StickerCriteria {
  filter: StickerFilter;
  employeeId?: number;
  scope: StickerScope | null;
}

export interface StickerStats {
  total: number;
  unread: number;
  urgent: number;
}

/** Output port for {@link EmployeeSticker}. */
export interface EmployeeStickerRepository {
  findById(id: number): Promise<EmployeeSticker | null>;
  /** Urgent first, newest first. */
  search(criteria: StickerCriteria, page: PageRequest): Promise<Paginated<EmployeeSticker>>;
  stats(scope: StickerScope | null): Promise<StickerStats>;
  /** Unread stickers of the employee (urgent first, newest first). */
  pendingFor(employeeId: number, limit: number): Promise<EmployeeSticker[]>;
  save(sticker: EmployeeSticker): Promise<void>;
  delete(id: number): Promise<void>;
}

export const EMPLOYEE_STICKER_REPOSITORY = Symbol('EmployeeStickerRepository');
