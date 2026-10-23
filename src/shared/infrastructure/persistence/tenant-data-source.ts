import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import type { UnitOfWorkPort } from '../../application/ports/unit-of-work.port.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantConnectionManager } from './tenant-connection-manager.js';

/**
 * Entry point for repositories to reach the current school's database.
 *
 * - Outside a transaction it returns the tenant's default manager.
 * - Inside {@link runInTransaction} it returns the transactional manager, so
 *   every repository joins the same transaction (Unit of Work).
 */
@Injectable()
export class TenantDataSource implements UnitOfWorkPort {
  private readonly transaction = new AsyncLocalStorage<EntityManager>();

  constructor(
    private readonly context: TenantContext,
    private readonly connections: TenantConnectionManager,
  ) {}

  async manager(): Promise<EntityManager> {
    const transactional = this.transaction.getStore();
    if (transactional) return transactional;
    const dataSource = await this.connections.dataSourceFor(this.context.require());
    return dataSource.manager;
  }

  async repository<T extends ObjectLiteral>(entity: EntityTarget<T>): Promise<Repository<T>> {
    return (await this.manager()).getRepository(entity);
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.transaction.getStore()) return work(); // nested: join the outer transaction
    const dataSource = await this.connections.dataSourceFor(this.context.require());
    return dataSource.transaction((manager) => this.transaction.run(manager, work));
  }
}
