import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ACCESS_LOG, type AccessLogPort } from './ports/access-log.port.js';

export interface LogoutInput {
  actor: AuthenticatedActor;
  ipAddress: string;
}

/**
 * Records the sign-out in the audit trail. Tokens are stateless (ADR-0005):
 * the client discards its token and clears per-user browser state (e.g. the
 * AI chat history, legacy bug S21).
 */
@Injectable()
export class LogoutUseCase implements UseCase<LogoutInput, void> {
  constructor(@Inject(ACCESS_LOG) private readonly accessLog: AccessLogPort) {}

  async execute({ actor, ipAddress }: LogoutInput): Promise<void> {
    await this.accessLog.record({
      userId: actor.userId,
      role: actor.role,
      path: '/auth/logout',
      module: 'auth',
      allowed: true,
      ipAddress,
    });
  }
}
