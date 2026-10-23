import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../../domain/role.js';

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint (or every endpoint of a controller) to the given
 * roles. `superadmin` is always allowed. Without this decorator any
 * authenticated user can access the endpoint.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
