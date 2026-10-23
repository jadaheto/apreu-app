import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ENVIRONMENT, type Environment } from '../config/environment.js';
import '../persistence/pg-type-parsers.js';
import { defaultDatabaseName, type Tenant, type TenantStatus } from './tenant.js';

interface TenantRow {
  id: number;
  slug: string;
  name: string;
  status: TenantStatus;
  db_name: string | null;
}

/** Looks up schools in the master database `tenants` table. */
export interface TenantLookup {
  findBySlug(slug: string): Promise<Tenant | null>;
  /** Current `status` only (cheap re-check of a cached tenant); `null` when the school no longer exists. */
  findStatusBySlug(slug: string): Promise<TenantStatus | null>;
}

export const TENANT_LOOKUP = Symbol('TenantLookup');

/**
 * Reads the master `tenants` table (owned by `superadmin-api`).
 * Only SELECTs are issued from this API. The slug is compared with `lower()`
 * on both sides (ADR-0008): `superadmin-api` stores it lower-cased, but a
 * master imported from MariaDB (`utf8mb4_general_ci`) may keep capitals.
 */
@Injectable()
export class MasterTenantLookup implements TenantLookup, OnModuleDestroy {
  private readonly logger = new Logger(MasterTenantLookup.name);
  private dataSource: DataSource | null = null;

  constructor(@Inject(ENVIRONMENT) private readonly env: Environment) {}

  async findBySlug(slug: string): Promise<Tenant | null> {
    const db = await this.connection();
    const rows: TenantRow[] = await db.query(
      'SELECT id, slug, name, status, db_name FROM tenants WHERE lower(slug) = lower($1) LIMIT 1',
      [slug],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      slug: row.slug,
      name: row.name,
      status: row.status,
      databaseName: row.db_name ?? defaultDatabaseName(this.env.tenantDb.databasePrefix, row.slug),
    };
  }

  async findStatusBySlug(slug: string): Promise<TenantStatus | null> {
    const db = await this.connection();
    const rows: Pick<TenantRow, 'status'>[] = await db.query(
      'SELECT status FROM tenants WHERE lower(slug) = lower($1) LIMIT 1',
      [slug],
    );
    return rows[0]?.status ?? null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource?.isInitialized) await this.dataSource.destroy();
  }

  private async connection(): Promise<DataSource> {
    if (!this.dataSource) {
      const { host, port, username, password, database } = this.env.masterDb;
      this.dataSource = new DataSource({
        type: 'postgres',
        host,
        port,
        username,
        password,
        database,
        applicationName: 'apreu-api',
        // ADR-0008: the master database works in UTC.
        extra: { max: 5, idleTimeoutMillis: 30_000, options: '-c TimeZone=UTC' },
      });
    }
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
      this.logger.log(`Conectado a la BD maestra ${this.env.masterDb.database}`);
    }
    return this.dataSource;
  }
}
