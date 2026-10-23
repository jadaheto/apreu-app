import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../../../../../shared/domain/domain-error.js';
import type { RequestWithActor } from '../../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/user.repository.js';
import { ALLOW_PENDING_PASSWORD_CHANGE } from './allow-pending-password-change.decorator.js';

/**
 * Global guard (registered by IdentityModule, runs after `JwtAuthGuard`) that
 * re-validates the account behind a valid token on every request:
 *
 * - Deactivated or deleted users lose access immediately (tokens are otherwise
 *   valid until they expire).
 * - Users holding a temporary password (`must_change_password`) may only call
 *   endpoints marked with `@AllowPendingPasswordChange()` until they change it.
 *
 * It costs one primary-key lookup per authenticated request.
 */
@Injectable()
export class ActiveSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { actor } = context.switchToHttp().getRequest<RequestWithActor>();
    if (!actor) return true; // public endpoint

    const user = await this.users.findById(actor.userId);
    if (!user || !user.isActive) throw new UnauthorizedError('Su usuario fue desactivado o ya no existe.');

    if (user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenError('Debe cambiar su contraseña temporal antes de continuar.', 'PASSWORD_CHANGE_REQUIRED');
      }
    }
    return true;
  }
}
