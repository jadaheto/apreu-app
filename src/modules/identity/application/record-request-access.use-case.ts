import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { describeRequestAccess, type AnsweredRequest } from '../domain/request-access.js';
import { ACCESS_LOG, type AccessLogPort } from './ports/access-log.port.js';

export interface RecordRequestAccessInput {
  actor: AuthenticatedActor;
  request: AnsweredRequest;
  ipAddress: string;
}

/**
 * Audits an authenticated API request in `access_log` (legacy
 * `logAccess()` on every page). Must run inside the school's tenant context,
 * since the table lives in the school database. Returns whether an entry was
 * written.
 */
@Injectable()
export class RecordRequestAccessUseCase implements UseCase<RecordRequestAccessInput, boolean> {
  constructor(@Inject(ACCESS_LOG) private readonly accessLog: AccessLogPort) {}

  async execute({ actor, request, ipAddress }: RecordRequestAccessInput): Promise<boolean> {
    const access = describeRequestAccess(request);
    if (!access) return false;
    await this.accessLog.record({ userId: actor.userId, role: actor.role, ipAddress, ...access });
    return true;
  }
}
