import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, UnauthorizedError } from '../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  EMPLOYMENT_STATUS,
  employmentAllowsAccess,
  type EmploymentStatusPort,
} from '../domain/employment-status.port.js';
import { SESSION_IDLE_TIMEOUT_SECONDS } from '../domain/session-policy.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import { TOKEN_ISSUER, type TokenIssuerPort } from './ports/token-issuer.port.js';

export interface RefreshSessionInput {
  userId: number;
  tenant: string;
}

export interface RefreshSessionOutput {
  accessToken: string;
  expiresIn: number;
  idleTimeoutSeconds: number;
}

/**
 * Sliding session: an active client exchanges its still-valid token for a
 * new one. The account is re-validated on every refresh (active, employment
 * status) and the token carries the *current* role, so deactivations and role
 * changes take effect without waiting for the old token to expire.
 */
@Injectable()
export class RefreshSessionUseCase implements UseCase<RefreshSessionInput, RefreshSessionOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EMPLOYMENT_STATUS) private readonly employment: EmploymentStatusPort,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuerPort,
  ) {}

  async execute({ userId, tenant }: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedError('Su sesión ya no es válida. Inicie sesión de nuevo.');

    const status = await this.employment.statusFor(userId, user.email.toString());
    if (!employmentAllowsAccess(user.role, status)) {
      throw new ForbiddenError('Tu acceso está inactivo. Contacta al departamento de RRHH.');
    }

    const token = await this.tokens.issue({
      userId,
      role: user.role,
      email: user.email.toString(),
      name: user.name,
      tenant,
    });
    return { ...token, idleTimeoutSeconds: SESSION_IDLE_TIMEOUT_SECONDS };
  }
}
