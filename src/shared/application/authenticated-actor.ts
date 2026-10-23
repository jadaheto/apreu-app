import type { Role } from '../domain/role.js';

/**
 * The authenticated user performing an operation. Passed from the HTTP
 * layer into use cases that need authorization or auditing.
 */
export interface AuthenticatedActor {
  userId: number;
  role: Role;
  email: string;
  name: string;
  tenant: string;
}
