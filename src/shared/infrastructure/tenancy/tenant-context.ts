import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Tenant } from './tenant.js';

/**
 * Holds the tenant of the request being processed.
 *
 * Backed by `AsyncLocalStorage`, so every async continuation started while
 * handling a request sees the same tenant without passing it around.
 */
@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<Tenant>();

  run<T>(tenant: Tenant, callback: () => T): T {
    return this.storage.run(tenant, callback);
  }

  /** Current tenant, or `undefined` outside a tenant-scoped request. */
  current(): Tenant | undefined {
    return this.storage.getStore();
  }

  /** Current tenant; throws when called outside a tenant-scoped request. */
  require(): Tenant {
    const tenant = this.current();
    if (!tenant) throw new Error('No hay un colegio (tenant) activo en el contexto de la petición.');
    return tenant;
  }
}
