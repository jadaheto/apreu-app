import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';

/** Builds an authenticated actor for tests. */
export const anActor = (role: Role, userId = 1): AuthenticatedActor => ({
  userId,
  role,
  email: `${role}${userId}@colegio.co`,
  name: `${role} ${userId}`,
  tenant: 'colegio-a',
});
