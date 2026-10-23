import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../../../../shared/infrastructure/config/environment.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import type { AssetStoragePort } from '../../application/ports/asset-storage.port.js';

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;

/**
 * Stores files on the local disk under `<UPLOADS_DIR>/<tenant>/<key>`
 * (default `./uploads`), outside any web-served folder: files are only
 * delivered through the API with a content type derived from their bytes.
 * Replace with an object-storage adapter for multi-instance deployments.
 */
@Injectable()
export class LocalAssetStorage implements AssetStoragePort {
  private readonly root: string;

  constructor(
    private readonly tenantContext: TenantContext,
    @Inject(ENVIRONMENT) env: Pick<Environment, 'storage'>,
  ) {
    this.root = resolve(env.storage.uploadsDir);
  }

  async save(key: string, content: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    if (!path) throw new Error(`Ruta de archivo no permitida: ${key}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { mode: 0o640 });
  }

  async read(key: string): Promise<Uint8Array | null> {
    const path = this.pathFor(key);
    if (!path) return null;
    try {
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const path = this.pathFor(key);
    if (path) await rm(path, { force: true });
  }

  /** Absolute path of a key inside the tenant folder; `null` for unsafe keys (traversal, odd legacy paths). */
  private pathFor(key: string): string | null {
    const tenantRoot = resolve(this.root, this.tenantContext.require().slug);
    const path = resolve(tenantRoot, key);
    return SAFE_KEY.test(key) && !key.includes('..') && path.startsWith(tenantRoot + sep) ? path : null;
  }
}
