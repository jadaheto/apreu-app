import type { AssetStoragePort } from '../application/ports/asset-storage.port.js';

export class InMemoryAssetStorage implements AssetStoragePort {
  readonly files = new Map<string, Uint8Array>();

  async save(key: string, content: Uint8Array): Promise<void> {
    this.files.set(key, content);
  }

  async read(key: string): Promise<Uint8Array | null> {
    return this.files.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}
