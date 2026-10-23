import { Inject, Injectable, Logger, type OnModuleDestroy, Optional } from '@nestjs/common';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENVIRONMENT, type Environment } from '../config/environment.js';
import { BackgroundTasks } from '../runtime/background-tasks.js';
import type { Tenant } from '../tenancy/tenant.js';
import './pg-type-parsers.js';
import { TenantEntityRegistry } from './tenant-entity-registry.js';

/** Time zone of every school connection (ADR-0008): Colombian local time. */
export const TENANT_TIME_ZONE = 'America/Bogota';

/** Maximum connections per school pool. */
const POOL_MAX = 10;
/** Idle time before `pg` releases a single connection of a pool. */
const CONNECTION_IDLE_MS = 30_000;
/** Upper bound for the sweep interval of idle pools. */
const MAX_SWEEP_INTERVAL_MS = 60_000;

interface PoolEntry {
  dataSource: Promise<DataSource>;
  lastUsedAt: number;
}

/** Subset of `pg.Pool` used to detect a pool that still has connections checked out. */
interface PgPoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/**
 * Keeps one TypeORM `DataSource` (PostgreSQL connection pool) per school database.
 *
 * - Pools are created on first use and reused while the school has traffic.
 * - A pool unused for `TENANT_POOL_IDLE_MINUTES` is closed (ADR-0008: one
 *   database per school means one pool per school, so inactive schools must not
 *   hold connections). A pool with connections still checked out is never closed.
 * - Every connection runs with `TimeZone = America/Bogota`.
 */
@Injectable()
export class TenantConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionManager.name);
  private readonly pools = new Map<string, PoolEntry>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Optional() private readonly backgroundTasks: BackgroundTasks = new BackgroundTasks(),
  ) {}

  dataSourceFor(tenant: Tenant): Promise<DataSource> {
    const now = Date.now();
    const existing = this.pools.get(tenant.databaseName);
    if (existing) {
      existing.lastUsedAt = now;
      return existing.dataSource;
    }
    const entry: PoolEntry = { dataSource: this.open(tenant), lastUsedAt: now };
    this.pools.set(tenant.databaseName, entry);
    // A failed initialization must not be cached forever.
    entry.dataSource.catch(() => {
      if (this.pools.get(tenant.databaseName) === entry) this.pools.delete(tenant.databaseName);
    });
    this.startSweeper();
    return entry.dataSource;
  }

  /** Number of open (or opening) school pools. */
  get openPools(): number {
    return this.pools.size;
  }

  /**
   * Closes the pools unused for longer than `tenantPoolIdleMinutes`.
   * Runs periodically; exposed for tests.
   */
  async closeIdlePools(now = Date.now()): Promise<void> {
    const maxIdleMs = this.env.tenantPoolIdleMinutes * 60_000;
    if (maxIdleMs <= 0) return;
    const expired = [...this.pools.entries()].filter(([, entry]) => now - entry.lastUsedAt >= maxIdleMs);
    await Promise.all(expired.map(([databaseName, entry]) => this.closeIfIdle(databaseName, entry)));
    if (this.pools.size === 0) this.stopSweeper();
  }

  /** Lets in-flight background writes (access audit, DIAN submissions) finish, then closes every pool. */
  async onModuleDestroy(): Promise<void> {
    this.stopSweeper();
    await this.backgroundTasks.drain();
    const entries = [...this.pools.values()];
    this.pools.clear();
    const sources = await Promise.allSettled(entries.map((entry) => entry.dataSource));
    await Promise.all(
      sources
        .filter((result): result is PromiseFulfilledResult<DataSource> => result.status === 'fulfilled')
        .map(({ value }) => value.destroy()),
    );
  }

  /** Builds the (not yet initialized) data source; overridable in tests. */
  protected createDataSource(options: DataSourceOptions): DataSource {
    return new DataSource(options);
  }

  private async open(tenant: Tenant): Promise<DataSource> {
    const { host, port, username, password } = this.env.tenantDb;
    const dataSource = this.createDataSource({
      type: 'postgres',
      host,
      port,
      username,
      password,
      database: tenant.databaseName,
      entities: TenantEntityRegistry.all(),
      synchronize: false,
      applicationName: 'apreu-api',
      extra: { max: POOL_MAX, idleTimeoutMillis: CONNECTION_IDLE_MS, options: `-c TimeZone=${TENANT_TIME_ZONE}` },
      logging: this.env.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
    });
    await dataSource.initialize();
    this.logger.log(`Pool abierto para el colegio ${tenant.slug} (${tenant.databaseName})`);
    return dataSource;
  }

  private async closeIfIdle(databaseName: string, entry: PoolEntry): Promise<void> {
    let dataSource: DataSource;
    try {
      dataSource = await entry.dataSource;
    } catch {
      return; // failed pools remove themselves
    }
    if (this.isBusy(dataSource) || this.pools.get(databaseName) !== entry) return;
    this.pools.delete(databaseName);
    try {
      await dataSource.destroy();
      this.logger.log(`Pool cerrado por inactividad (${databaseName})`);
    } catch (error) {
      this.logger.warn(`No se pudo cerrar el pool de ${databaseName}: ${(error as Error).message}`);
    }
  }

  /** True while the pool has connections checked out or requests waiting for one. */
  private isBusy(dataSource: DataSource): boolean {
    const pool = (dataSource.driver as { master?: PgPoolStats }).master;
    if (!pool) return false;
    return pool.totalCount - pool.idleCount > 0 || pool.waitingCount > 0;
  }

  private startSweeper(): void {
    const maxIdleMs = this.env.tenantPoolIdleMinutes * 60_000;
    if (this.sweeper || maxIdleMs <= 0) return;
    const interval = Math.min(maxIdleMs, MAX_SWEEP_INTERVAL_MS);
    this.sweeper = setInterval(() => void this.closeIdlePools(), interval);
    this.sweeper.unref();
  }

  private stopSweeper(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }
}
