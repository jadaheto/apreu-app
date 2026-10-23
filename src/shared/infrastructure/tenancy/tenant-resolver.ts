import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError, ForbiddenError, NotFoundError } from '../../domain/domain-error.js';
import { CLOCK, type ClockPort } from '../../application/ports/clock.port.js';
import { ENVIRONMENT, type Environment } from '../config/environment.js';
import { isValidTenantSlug, type Tenant } from './tenant.js';
import { TENANT_LOOKUP, type TenantLookup } from './tenant-registry.js';

interface CacheEntry {
  tenant: Tenant;
  expiresAt: number;
  /** When `tenant.status` must be re-read from the master DB. */
  statusExpiresAt: number;
}

/**
 * Turns a slug into an active {@link Tenant}.
 *
 * - The whole tenant is cached for `tenantCacheTtlSeconds` to avoid hitting
 *   the master DB on every request.
 * - Its `status` is re-read (one-column query) every `tenantStatusTtlSeconds`
 *   (short), so suspending a school from `superadmin-api` blocks it within
 *   seconds on every instance, without waiting for the full cache TTL.
 * - {@link invalidate} drops an entry immediately (called by the internal
 *   endpoint `POST /api/internal/tenants/{slug}/invalidate`).
 */
@Injectable()
export class TenantResolver {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(TENANT_LOOKUP) private readonly lookup: TenantLookup,
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async resolve(rawSlug: string | undefined): Promise<Tenant> {
    const slug = TenantResolver.normalize(rawSlug ?? this.env.defaultTenant ?? '');
    const now = this.clock.now().getTime();
    const cached = this.cache.get(slug);
    const tenant =
      cached && cached.expiresAt > now ? await this.revalidated(slug, cached, now) : await this.load(slug, now);

    if (tenant.status === 'suspended') {
      throw new ForbiddenError(
        `El colegio "${tenant.name}" está suspendido. Contacte al administrador de la plataforma.`,
      );
    }
    return tenant;
  }

  /** Forgets the cached tenant so the next request reads the master DB again. Returns whether it was cached. */
  invalidate(rawSlug: string): boolean {
    return this.cache.delete(TenantResolver.normalize(rawSlug));
  }

  private static normalize(raw: string): string {
    const slug = raw.trim().toLowerCase();
    if (!slug) {
      throw new BusinessRuleViolationError('Debe indicar el colegio (cabecera X-Tenant).', 'TENANT_REQUIRED');
    }
    if (!isValidTenantSlug(slug)) {
      throw new BusinessRuleViolationError(`Identificador de colegio inválido: "${slug}".`, 'TENANT_INVALID');
    }
    return slug;
  }

  private async revalidated(slug: string, entry: CacheEntry, now: number): Promise<Tenant> {
    if (entry.statusExpiresAt > now) return entry.tenant;
    const status = await this.lookup.findStatusBySlug(slug);
    if (status === null) {
      this.cache.delete(slug);
      throw new NotFoundError('Colegio', slug);
    }
    entry.tenant = { ...entry.tenant, status };
    entry.statusExpiresAt = now + this.env.tenantStatusTtlSeconds * 1000;
    return entry.tenant;
  }

  private async load(slug: string, now: number): Promise<Tenant> {
    const tenant = await this.lookup.findBySlug(slug);
    if (!tenant) throw new NotFoundError('Colegio', slug);
    this.cache.set(slug, {
      tenant,
      expiresAt: now + this.env.tenantCacheTtlSeconds * 1000,
      statusExpiresAt: now + this.env.tenantStatusTtlSeconds * 1000,
    });
    return tenant;
  }
}
