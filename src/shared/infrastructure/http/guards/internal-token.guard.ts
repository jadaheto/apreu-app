import { createHash, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../domain/domain-error.js';
import { ENVIRONMENT, type Environment } from '../../config/environment.js';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Protects service-to-service endpoints (`/api/internal/**`, called by
 * `superadmin-api`) with the shared secret `INTERNAL_API_TOKEN`, sent in the
 * `X-Internal-Token` header. Compared in constant time; when the variable is
 * not configured the endpoints are disabled.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(@Inject(ENVIRONMENT) private readonly env: Pick<Environment, 'internalApiToken'>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.env.internalApiToken;
    if (!expected) {
      throw new ForbiddenError('La API interna no está habilitada (INTERNAL_API_TOKEN).', 'INTERNAL_API_DISABLED');
    }
    const header = context.switchToHttp().getRequest<Request>().headers[INTERNAL_TOKEN_HEADER];
    const received = Array.isArray(header) ? header[0] : header;
    if (!received || !timingSafeEqual(digest(received), digest(expected))) {
      throw new UnauthorizedError('Token interno inválido.');
    }
    return true;
  }
}
