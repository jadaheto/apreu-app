import type { Environment } from '../config/environment.js';
import { MasterTenantLookup } from './tenant-registry.js';

describe('MasterTenantLookup', () => {
  const env = { tenantDb: { databasePrefix: 'apreu_' } } as Environment;
  const query = vi.fn();
  const lookup = new MasterTenantLookup(env);
  // Bypass the real master connection: only the SQL emitted matters here.
  vi.spyOn(lookup as unknown as { connection: () => Promise<unknown> }, 'connection').mockResolvedValue({ query });

  beforeEach(() => query.mockReset());

  it('matches the slug without case, for masters imported from MariaDB (ADR-0008)', async () => {
    query.mockResolvedValue([{ id: '3', slug: 'Colegio-Norte', name: 'Norte', status: 'active', db_name: null }]);
    await expect(lookup.findBySlug('colegio-norte')).resolves.toEqual({
      id: 3,
      slug: 'Colegio-Norte',
      name: 'Norte',
      status: 'active',
      databaseName: 'apreu_Colegio_Norte',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE lower(slug) = lower($1)'), ['colegio-norte']);
  });

  it('re-reads the status with the same case-insensitive match', async () => {
    query.mockResolvedValue([{ status: 'suspended' }]);
    await expect(lookup.findStatusBySlug('colegio-norte')).resolves.toBe('suspended');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE lower(slug) = lower($1)'), ['colegio-norte']);
  });
});
