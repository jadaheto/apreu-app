import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { BackgroundTasks } from '../../../../shared/infrastructure/runtime/background-tasks.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import type { RequestWithTenant } from '../../../../shared/infrastructure/tenancy/tenant.middleware.js';
import { RecordRequestAccessUseCase } from '../../application/record-request-access.use-case.js';

type AuditedRequest = Request & RequestWithActor & RequestWithTenant;

/**
 * Per-request access audit. It is a middleware (not an interceptor) because
 * guards run before interceptors: a 403 thrown by `RolesGuard` would never be
 * seen by an interceptor. The entry is written once the response has been
 * sent (`finish`), fire-and-forget: it never delays nor fails the request
 * (tracked in {@link BackgroundTasks} so shutdown waits for it).
 *
 * Only authenticated requests are audited (`req.actor`, set by
 * `JwtAuthGuard`), inside the school of the request (`req.tenant`, set by
 * `TenantMiddleware`), because `access_log` lives in each school database.
 */
@Injectable()
export class RequestAuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestAuditMiddleware.name);

  constructor(
    private readonly recordAccess: RecordRequestAccessUseCase,
    private readonly tenantContext: TenantContext,
    private readonly backgroundTasks: BackgroundTasks,
  ) {}

  use(req: AuditedRequest, res: Response, next: NextFunction): void {
    res.once('finish', () => this.audit(req, res));
    next();
  }

  private audit(req: AuditedRequest, res: Response): void {
    const { actor, tenant } = req;
    if (!actor || !tenant) return;
    const input = {
      actor,
      request: { method: req.method, url: req.originalUrl ?? req.url, statusCode: res.statusCode },
      ipAddress: req.ip ?? '0.0.0.0',
    };
    // Tracked so a graceful shutdown waits for the write before closing the pools.
    this.backgroundTasks
      .track(this.tenantContext.run(tenant, () => this.recordAccess.execute(input)))
      .catch((error: unknown) =>
        this.logger.warn(
          `No se pudo auditar ${input.request.method} ${input.request.url}: ${(error as Error).message}`,
        ),
      );
  }
}
