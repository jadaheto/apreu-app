/**
 * Roles available in a school (tenant). Mirrors the `users.role` ENUM.
 *
 * - `superadmin`: platform operator, bypasses every permission check.
 * - `admin`: school director / administrator.
 * - `finance`, `hr`: back-office staff.
 * - `teacher`, `employee`: staff using the employee portal.
 * - `student`, `parent`: users of the student portal.
 */
export enum Role {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  FINANCE = 'finance',
  HR = 'hr',
  TEACHER = 'teacher',
  EMPLOYEE = 'employee',
  STUDENT = 'student',
  PARENT = 'parent',
}

export const ALL_ROLES: readonly Role[] = Object.values(Role);

/** Back-office roles that use the administrative portal. */
export const BACK_OFFICE_ROLES: readonly Role[] = [Role.SUPERADMIN, Role.ADMIN, Role.FINANCE, Role.HR];

/** Portal the user lands on after logging in (legacy redirect rules). */
export type Portal = 'admin' | 'employee' | 'student';

export const portalForRole = (role: Role): Portal => {
  switch (role) {
    case Role.TEACHER:
    case Role.EMPLOYEE:
      return 'employee';
    case Role.STUDENT:
    case Role.PARENT:
      return 'student';
    default:
      return 'admin';
  }
};
