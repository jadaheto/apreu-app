import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { Role } from '../../../shared/domain/role.js';

/** Roles that manage employees, leaves and payroll (legacy `$PAGE_PERMISSIONS['hr']`). */
export const HR_MANAGER_ROLES: readonly Role[] = [Role.SUPERADMIN, Role.ADMIN, Role.HR];

/** Roles that may read every payslip and payroll figure (legacy `payroll` permission). */
export const PAYROLL_VIEWER_ROLES: readonly Role[] = [...HR_MANAGER_ROLES, Role.FINANCE];

/**
 * Roles that may use the employee self-service. Back-office staff can also be
 * employees; students and guardians never.
 */
export const SELF_SERVICE_ROLES: readonly Role[] = [Role.TEACHER, Role.EMPLOYEE, Role.HR, Role.FINANCE, Role.ADMIN];

export const isHrManager = (actor: AuthenticatedActor): boolean => HR_MANAGER_ROLES.includes(actor.role);

export const isPayrollViewer = (actor: AuthenticatedActor): boolean => PAYROLL_VIEWER_ROLES.includes(actor.role);
