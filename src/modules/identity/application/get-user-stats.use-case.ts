import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../../shared/domain/role.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';

/** KPIs of the user administration screen. */
export interface UserStatsView {
  total: number;
  /** superadmin + admin */
  admins: number;
  /** teacher + employee + hr + finance */
  staff: number;
  /** parent + student */
  families: number;
  inactive: number;
}

const ADMIN_ROLES = [Role.SUPERADMIN, Role.ADMIN];
const STAFF_ROLES = [Role.TEACHER, Role.EMPLOYEE, Role.HR, Role.FINANCE];
const FAMILY_ROLES = [Role.PARENT, Role.STUDENT];

/** Counts users by role family (legacy `admin/users.php` KPI cards). */
@Injectable()
export class GetUserStatsUseCase implements UseCase<void, UserStatsView> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(): Promise<UserStatsView> {
    const { total, inactive, byRole } = await this.users.statistics();
    const sum = (roles: Role[]) => roles.reduce((acc, role) => acc + (byRole[role] ?? 0), 0);
    return { total, admins: sum(ADMIN_ROLES), staff: sum(STAFF_ROLES), families: sum(FAMILY_ROLES), inactive };
  }
}
