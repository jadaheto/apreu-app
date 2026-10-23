import type { Role } from '../../domain/role.js';

/** Claims carried by the access token. */
export interface AccessTokenClaims {
  sub: number;
  role: Role;
  email: string;
  name: string;
  /** Slug of the school that issued the token. */
  tenant: string;
}
