import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../domain/domain-error.js';
import type { AccessTokenClaims } from '../../security/access-token.js';
import { TenantContext } from '../../tenancy/tenant-context.js';
import type { RequestWithActor } from '../decorators/current-actor.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Global guard: validates the Bearer token, checks it was issued for the
 * school of the current request and attaches the actor to the request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & RequestWithActor>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedError('Debe iniciar sesión.');

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedError('La sesión expiró o no es válida.');
    }

    const tenant = this.tenantContext.current();
    if (tenant && tenant.slug !== claims.tenant) {
      throw new ForbiddenError('El token no pertenece a este colegio.');
    }

    request.actor = {
      userId: claims.sub,
      role: claims.role,
      email: claims.email,
      name: claims.name,
      tenant: claims.tenant,
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, value] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && value ? value : null;
  }
}
