import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSticker } from '../../domain/stickers/employee-sticker.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { USER_ACCOUNTS, type UserAccountPort } from '../../domain/employees/user-account.port.js';
import { toStickerView, type StickerView } from './sticker-view.js';

/** Builds sticker views resolving employee and author names in two batch queries. */
@Injectable()
export class StickerViewAssembler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_ACCOUNTS) private readonly users: UserAccountPort,
  ) {}

  async toViews(stickers: EmployeeSticker[]): Promise<StickerView[]> {
    const employeeIds = [...new Set(stickers.map((s) => s.employeeId))];
    const authorIds = [...new Set(stickers.map((s) => s.createdBy).filter((id): id is number => id !== null))];
    const [employees, authors] = await Promise.all([
      this.employees.findByIds(employeeIds),
      this.users.namesByIds(authorIds),
    ]);
    const names = new Map(employees.map((e) => [e.id as number, e.fullName]));
    return stickers.map((s) =>
      toStickerView(
        s,
        names.get(s.employeeId) ?? null,
        s.createdBy === null ? null : (authors.get(s.createdBy) ?? null),
      ),
    );
  }
}
