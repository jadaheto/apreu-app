import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../application/authenticated-actor.js';

export interface RequestWithActor {
  actor?: AuthenticatedActor;
}

/** Injects the {@link AuthenticatedActor} attached by `JwtAuthGuard`. */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedActor => {
  const request = ctx.switchToHttp().getRequest<RequestWithActor>();
  if (!request.actor) throw new Error('CurrentActor usado en un endpoint público.');
  return request.actor;
});
