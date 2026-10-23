import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../../../shared/domain/role.js';
import type { Employee } from '../../domain/employees/employee.js';
import { USER_ACCOUNTS, type UserAccountPort } from '../../domain/employees/user-account.port.js';

/**
 * Keeps `users.is_active` aligned with the employee status on every change
 * (legacy only did it from the full form, B-26): active/on-leave employees
 * can sign in, everyone else cannot — whatever their role. Superadmin
 * accounts are never touched from HR.
 */
@Injectable()
export class UserAccessSynchronizer {
  constructor(@Inject(USER_ACCOUNTS) private readonly users: UserAccountPort) {}

  async sync(employee: Employee): Promise<void> {
    if (employee.userId === null) return;
    const account = await this.users.findById(employee.userId);
    if (!account || account.role === Role.SUPERADMIN) return;
    if (account.isActive !== employee.hasPortalAccess) {
      await this.users.setActive(account.id, employee.hasPortalAccess);
    }
  }
}
