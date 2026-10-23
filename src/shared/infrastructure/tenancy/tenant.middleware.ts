import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Tenant } from './tenant.js';
import { TenantContext } from './tenant-context.js';
import { TenantResolver } from './tenant-resolver.js';

export const TENANT_HEADER = 'x-tenant';

/** The resolved school is also attached to the request for code running outside its async context (e.g. `res.on('finish')`). */
export interface RequestWithTenant {
  tenant?: Tenant;
}

/**
 * Callback URLs of external systems that cannot send headers carry the school
 * in the path instead, e.g. `/api/webhooks/whatsapp/<slug>` (Meta).
 */
const TENANT_IN_PATH = /^\/api\/webhooks\/[a-z-]+\/([a-z0-9-]+)(?:[/?]|$)/i;

/** Slug of the school addressed by the request: `X-Tenant` header, then webhook path. */
export const tenantSlugOf = (req: Pick<Request, 'headers' | 'originalUrl'>): string | undefined => {
  const header = req.headers[TENANT_HEADER];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader ?? TENANT_IN_PATH.exec(req.originalUrl ?? '')?.[1];
};

/**
 * Resolves the school of the request and runs the rest of the pipeline
 * (guards, interceptors, handler) inside its context.
 *
 * Errors are thrown (not passed to `next`) so Nest's middleware proxy routes
 * them through the global exception filter.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly resolver: TenantResolver,
    private readonly context: TenantContext,
  ) {}

  async use(req: Request & RequestWithTenant, _res: Response, next: NextFunction): Promise<void> {
    const tenant = await this.resolver.resolve(tenantSlugOf(req));
    req.tenant = tenant;
    this.context.run(tenant, () => next());
  }
}
