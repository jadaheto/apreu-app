import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../../../../shared/infrastructure/config/environment.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import type { FileStoragePort } from '../../application/ports/file-storage.port.js';

/**
 * Stores files on the local disk under `<UPLOADS_DIR>/<tenant>/<path>`
 * (default `./uploads`). Paths can never escape the tenant folder, and
 * files are only read back by the API (never served or executed from a web
 * root, unlike the legacy `uploads/email/`).
 */
@Injectable()
export class LocalFileStorage implements FileStoragePort {
  private readonly root: string;

  constructor(
    private readonly tenants: TenantContext,
    @Inject(ENVIRONMENT) env: Pick<Environment, 'storage'>,
  ) {
    this.root = resolve(env.storage.uploadsDir);
  }

  async save(relativePath: string, content: Buffer): Promise<void> {
    const target = this.resolve(relativePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o750 });
    await writeFile(target, content, { mode: 0o640 });
  }

  async read(relativePath: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(relativePath));
    } catch {
      return null;
    }
  }

  private resolve(relativePath: string): string {
    const base = resolve(this.root, this.tenants.require().slug);
    const target = resolve(base, relativePath);
    if (!target.startsWith(base + sep)) throw new Error('Ruta de archivo fuera del directorio permitido.');
    return target;
  }
}
