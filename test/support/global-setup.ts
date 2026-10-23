import { createE2eDatabases, dropE2eDatabases } from './e2e-databases.js';

/**
 * Vitest global setup of the E2E suite: clones `apreu_demo` / `apreu_master`
 * into `apreu_e2e_demo` / `apreu_e2e_master` and drops them afterwards
 * (set `E2E_KEEP_DB=1` to keep them for inspection).
 */
export async function setup(): Promise<void> {
  await createE2eDatabases();
}

export async function teardown(): Promise<void> {
  if (process.env.E2E_KEEP_DB === '1') return;
  await dropE2eDatabases();
}
