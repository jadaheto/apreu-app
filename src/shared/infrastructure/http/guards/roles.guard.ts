import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../../domain/domain-error.js';
import { Role } from '../../../domain/role.js';
import type { RequestWithActor } from '../decorators/current-actor.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Global guard enforcing `@Roles(...)`. Runs after {@link JwtAuthGuard}. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { actor } = context.switchToHttp().getRequest<RequestWithActor>();
    if (!actor) return true; // public endpoint: JwtAuthGuard already decided
    if (actor.role === Role.SUPERADMIN || required.includes(actor.role)) return true;
    throw new ForbiddenError();
  }
}
