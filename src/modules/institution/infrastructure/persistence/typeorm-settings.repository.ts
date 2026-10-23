import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { SqlParams } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { SettingsRepository } from '../../domain/settings/settings.repository.js';
import { SettingOrmEntity } from './setting.orm-entity.js';

/** Key/value access to `settings`; writes are a single parameterized upsert. */
@Injectable()
export class TypeOrmSettingsRepository implements SettingsRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findMany(keys: readonly string[]): Promise<Map<string, string | null>> {
    if (!keys.length) return new Map();
    const rows = await (await this.db.repository(SettingOrmEntity)).find({ where: { key: In([...new Set(keys)]) } });
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  async saveMany(values: ReadonlyMap<string, string | null>): Promise<void> {
    if (!values.size) return;
    const params = new SqlParams();
    const rows = [...values].map(([key, value]) => `(${params.add(key)}, ${params.add(value)})`);
    await (
      await this.db.manager()
    ).query(
      `INSERT INTO settings (key, value) VALUES ${rows.join(', ')}
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      params.values,
    );
  }
}
