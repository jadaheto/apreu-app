import { Role } from '../../../../shared/domain/role.js';

/** `enforcePageAccess('accounting')`: admin and finance (superadmin always passes). */
export const ACCOUNTING_ROLES = [Role.ADMIN, Role.FINANCE] as const;
