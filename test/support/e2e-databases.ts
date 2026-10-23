import pg from 'pg';

/**
 * Throw-away databases of the end-to-end suite (ADR-0008). They are cloned
 * with `CREATE DATABASE … TEMPLATE` from the development databases, which are
 * never modified, and dropped when the run ends.
 */
export const E2E = {
  sourceTenantDb: process.env.E2E_SOURCE_TENANT_DB ?? 'apreu_demo',
  sourceMasterDb: process.env.E2E_SOURCE_MASTER_DB ?? 'apreu_master',
  tenantDb: 'apreu_e2e_demo',
  masterDb: 'apreu_e2e_master',
  /** School served by the cloned tenant database. */
  tenant: 'e2e-demo',
  /** Second school on the same database, suspended by the tenancy test. */
  tenantToSuspend: 'e2e-suspendible',
  internalToken: 'e2e-internal-token-0123456789abcdef',
} as const;

const connectionTo = (database: string): pg.ClientConfig => ({
  host: process.env.TENANT_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.TENANT_DB_PORT ?? 5432),
  user: process.env.TENANT_DB_USER ?? 'postgres',
  password: process.env.TENANT_DB_PASSWORD ?? 'postgres',
  database,
});

/** Runs `work` with a client connected to `database` (default: the `postgres` maintenance DB). */
export async function withClient<T>(work: (client: pg.Client) => Promise<T>, database = 'postgres'): Promise<T> {
  const client = new pg.Client(connectionTo(database));
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Client on the cloned school database, for assertions that the API does not expose. */
export const withTenantDb = <T>(work: (client: pg.Client) => Promise<T>): Promise<T> => withClient(work, E2E.tenantDb);

/** Client on the cloned master database. */
export const withMasterDb = <T>(work: (client: pg.Client) => Promise<T>): Promise<T> => withClient(work, E2E.masterDb);

const quoted = (name: string): string => `"${name.replace(/"/g, '""')}"`;

export async function dropE2eDatabases(): Promise<void> {
  await withClient(async (client) => {
    for (const db of [E2E.tenantDb, E2E.masterDb]) {
      await client.query(`DROP DATABASE IF EXISTS ${quoted(db)} WITH (FORCE)`);
    }
  });
}

/** Drops leftovers of a previous run and clones the development databases. */
export async function createE2eDatabases(): Promise<void> {
  await dropE2eDatabases();
  await withClient(async (client) => {
    // TEMPLATE requires that nobody is connected to the source database.
    for (const [target, source] of [
      [E2E.tenantDb, E2E.sourceTenantDb],
      [E2E.masterDb, E2E.sourceMasterDb],
    ]) {
      const busy = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1',
        [source],
      );
      if (busy.rows[0].n > 0) {
        throw new Error(
          `La BD ${source} tiene ${busy.rows[0].n} conexión(es) abiertas; ciérrelas (p. ej. detenga la API de desarrollo) para poder clonarla.`,
        );
      }
      await client.query(`CREATE DATABASE ${quoted(target)} TEMPLATE ${quoted(source)}`);
    }
  });
  await withMasterDb(async (client) => {
    await client.query(
      `INSERT INTO tenants (slug, name, admin_email, status, tables_created, db_name)
       VALUES ($1, 'Colegio E2E', 'director@demo.co', 'active', true, $3),
              ($2, 'Colegio E2E Suspendible', 'director@demo.co', 'active', true, $3)`,
      [E2E.tenant, E2E.tenantToSuspend, E2E.tenantDb],
    );
  });
}
