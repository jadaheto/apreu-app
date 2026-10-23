import { Role } from '../../../shared/domain/role.js';

/**
 * Employment status of the staff member linked to a user (`employees.status`).
 * Owned by the HR context; identity only reads it to decide whether a
 * teacher/employee may sign in.
 */
export type EmploymentStatus = 'active' | 'on_leave' | 'inactive' | 'terminated' | string;

export interface EmploymentStatusPort {
  /** Status of the employee linked by `user_id` or e-mail; `null` when there is none. */
  statusFor(userId: number, email: string): Promise<EmploymentStatus | null>;
}

export const EMPLOYMENT_STATUS = Symbol('EmploymentStatusPort');

/** User whose linked employee record is looked up. */
export interface EmployeeLinkKey {
  userId: number;
  email: string;
}

/** Batch variant used by the user listing to avoid one query per row. */
export interface EmploymentDirectoryPort {
  /** Status by user id for the users that have a linked employee (by `user_id` or e-mail). */
  statusesFor(users: readonly EmployeeLinkKey[]): Promise<ReadonlyMap<number, EmploymentStatus>>;
}

export const EMPLOYMENT_DIRECTORY = Symbol('EmploymentDirectoryPort');

/** Statuses that keep portal access (legacy `login.php`). */
export const EMPLOYMENT_STATUSES_WITH_ACCESS: readonly string[] = ['active', 'on_leave'];

/** Roles whose access depends on the employment status (legacy `login.php`). */
export const EMPLOYMENT_CHECKED_ROLES: readonly Role[] = [Role.TEACHER, Role.EMPLOYEE];

/** True when the role/status combination keeps portal access. */
export const employmentAllowsAccess = (role: Role, status: EmploymentStatus | null): boolean =>
  !EMPLOYMENT_CHECKED_ROLES.includes(role) || status === null || EMPLOYMENT_STATUSES_WITH_ACCESS.includes(status);
