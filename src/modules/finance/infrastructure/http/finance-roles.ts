import { Role } from '../../../../shared/domain/role.js';

/** Finance back office (superadmin always passes `RolesGuard`). */
export const FINANCE_STAFF = [Role.ADMIN, Role.FINANCE] as const;

/** Configuration and irreversible operations reserved to the school's administration. */
export const FINANCE_ADMIN = [Role.ADMIN] as const;

/** Staff plus portal users; ownership is verified by the use case. */
export const FINANCE_STAFF_AND_PORTAL = [Role.ADMIN, Role.FINANCE, Role.STUDENT, Role.PARENT] as const;
