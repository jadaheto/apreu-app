/** Binary storage for tenant files (e-mail images). Paths are relative and tenant-scoped by the adapter. */
export interface FileStoragePort {
  save(relativePath: string, content: Buffer): Promise<void>;
  /** `null` when the file does not exist. */
  read(relativePath: string): Promise<Buffer | null>;
}

export const FILE_STORAGE = Symbol('FileStoragePort');
