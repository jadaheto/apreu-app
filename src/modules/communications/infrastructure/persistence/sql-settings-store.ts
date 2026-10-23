import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { SettingsStorePort } from '../../application/ports/settings-store.port.js';

const KEY_PATTERN = /^[a-z0-9_]{1,50}$/;

/** Reads/writes the key/value `settings` table (identity context) with plain SQL. */
@Injectable()
export class SqlSettingsStore implements SettingsStorePort {
  constructor(private readonly db: TenantDataSource) {}

  async read(keys: readonly string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query('SELECT key, value FROM settings WHERE key = ANY($1::varchar[])', [keys]);
    return Object.fromEntries(rows.filter((row) => row.value !== null).map((row) => [row.key, row.value as string]));
  }

  async write(key: string, value: string): Promise<void> {
    if (!KEY_PATTERN.test(key)) throw new Error(`Clave de configuración inválida: ${key}`);
    await (
      await this.db.manager()
    ).query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value],
    );
  }
}
