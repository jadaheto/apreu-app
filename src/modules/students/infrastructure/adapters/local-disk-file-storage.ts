import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { BusinessRuleViolationError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import type { FileStoragePort } from '../../application/ports/file-storage.port.js';

const SEGMENT = /^[A-Za-z0-9_-]+$/;
const FILE_NAME = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,5}$/;

/**
 * Stores files on the local disk under `uploads/`, a folder that is not
 * served statically nor executable (legacy wrote to `public/uploads` with
 * `mkdir 0777`, S4). Paths are confined to the root (no traversal) and
 * permissions are restrictive.
 */
export class LocalDiskFileStorage implements FileStoragePort {
  private readonly root: () => string;

  /** @param root folder, or a function returning it (e.g. per-tenant folder resolved per request). */
  constructor(root: string | (() => string)) {
    this.root = typeof root === 'string' ? () => resolve(root) : () => resolve(root());
  }

  async save(directory: string, fileName: string, content: Uint8Array): Promise<string> {
    if (!SEGMENT.test(directory) || !FILE_NAME.test(fileName)) {
      throw new BusinessRuleViolationError('Nombre de archivo no permitido.', 'INVALID_FILE_NAME');
    }
    const folder = this.inside(directory);
    await mkdir(folder, { recursive: true, mode: 0o750 });
    await writeFile(this.inside(`${directory}/${fileName}`), content, {
      mode: 0o640,
    });
    return `${directory}/${fileName}`;
  }

  async read(path: string): Promise<Uint8Array> {
    try {
      return await readFile(this.inside(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundError('Archivo', path);
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await unlink(this.inside(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  /** Absolute path of `relative` inside the root; rejects anything escaping it. */
  private inside(relative: string): string {
    const root = this.root();
    const absolute = resolve(root, relative);
    if (!absolute.startsWith(root + sep)) {
      throw new BusinessRuleViolationError('Ruta de archivo no permitida.', 'INVALID_FILE_PATH');
    }
    return absolute;
  }
}
