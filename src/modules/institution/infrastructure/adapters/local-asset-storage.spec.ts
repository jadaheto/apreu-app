import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import { LocalAssetStorage } from './local-asset-storage.js';

describe('LocalAssetStorage', () => {
  const context = new TenantContext();
  const tenant = { id: 1, slug: 'colegio-a', name: 'A', status: 'active' as const, databaseName: 'x' };
  let root: string;
  let storage: LocalAssetStorage;
  const inTenant = <T>(work: () => Promise<T>) => context.run(tenant, work);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'apreu-assets-'));
    storage = new LocalAssetStorage(context, { storage: { uploadsDir: root } });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('saves, reads and deletes files inside the tenant folder', async () => {
    await inTenant(() => storage.save('institution/logo-1.png', new Uint8Array([1, 2, 3])));
    expect(Array.from((await inTenant(() => storage.read('institution/logo-1.png'))) ?? [])).toEqual([1, 2, 3]);
    await inTenant(() => storage.delete('institution/logo-1.png'));
    await expect(inTenant(() => storage.read('institution/logo-1.png'))).resolves.toBeNull();
    await expect(inTenant(() => storage.delete('institution/logo-1.png'))).resolves.toBeUndefined();
  });

  it('refuses path traversal', async () => {
    await expect(inTenant(() => storage.save('../otro-colegio/x.png', new Uint8Array([1])))).rejects.toThrow();
    await expect(inTenant(() => storage.read('../../etc/passwd'))).resolves.toBeNull();
  });
});
