import type { Role } from '../../../../shared/domain/role.js';

export interface TokenSubject {
  userId: number;
  role: Role;
  email: string;
  name: string;
  tenant: string;
}

export interface IssuedToken {
  accessToken: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

/** Issues signed access tokens for authenticated users. */
export interface TokenIssuerPort {
  issue(subject: TokenSubject): Promise<IssuedToken>;
}

export const TOKEN_ISSUER = Symbol('TokenIssuerPort');
