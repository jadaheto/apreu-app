import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, UnauthorizedError } from '../../../shared/domain/domain-error.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../../../shared/application/ports/password-hasher.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  EMPLOYMENT_CHECKED_ROLES,
  EMPLOYMENT_STATUS,
  employmentAllowsAccess,
  type EmploymentStatusPort,
} from '../domain/employment-status.port.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import { ACCESS_LOG, type AccessLogPort } from './ports/access-log.port.js';
import { TOKEN_ISSUER, type TokenIssuerPort } from './ports/token-issuer.port.js';
import { toUserView, type UserView } from './user-view.js';

export interface LoginInput {
  email: string;
  password: string;
  tenant: string;
  ipAddress: string;
}

export interface LoginOutput {
  accessToken: string;
  expiresIn: number;
  user: UserView;
}

/**
 * Authenticates a user of a school (legacy `login.php`).
 *
 * Rules:
 * 1. E-mail and password must match an active user. The error message never
 *    reveals which of the two was wrong.
 * 2. Teachers/employees also need their employee record in `active` or
 *    `on_leave` status (users without an employee record are allowed).
 * 3. On success `last_login` is updated and the access is audited.
 */
@Injectable()
export class LoginUseCase implements UseCase<LoginInput, LoginOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(EMPLOYMENT_STATUS) private readonly employment: EmploymentStatusPort,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuerPort,
    @Inject(ACCESS_LOG) private readonly accessLog: AccessLogPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.users.findByEmail(input.email.trim().toLowerCase());
    const passwordMatches = user ? await this.hasher.verify(input.password, user.passwordHash) : false;

    if (!user || !passwordMatches || !user.isActive) {
      await this.audit(user?.id ?? 0, user?.role ?? '', input, false);
      throw new UnauthorizedError('Correo o contraseña incorrectos.');
    }

    if (EMPLOYMENT_CHECKED_ROLES.includes(user.role)) {
      const status = await this.employment.statusFor(user.id as number, user.email.toString());
      if (!employmentAllowsAccess(user.role, status)) {
        await this.audit(user.id as number, user.role, input, false);
        throw new ForbiddenError('Tu acceso está inactivo. Contacta al departamento de RRHH.');
      }
    }

    user.recordLogin(this.clock.now());
    await this.users.save(user);
    await this.audit(user.id as number, user.role, input, true);

    const token = await this.tokens.issue({
      userId: user.id as number,
      role: user.role,
      email: user.email.toString(),
      name: user.name,
      tenant: input.tenant,
    });
    return { ...token, user: toUserView(user) };
  }

  private audit(userId: number, role: string, input: LoginInput, allowed: boolean): Promise<void> {
    return this.accessLog.record({
      userId,
      role,
      path: '/auth/login',
      module: 'auth',
      allowed,
      ipAddress: input.ipAddress,
    });
  }
}
