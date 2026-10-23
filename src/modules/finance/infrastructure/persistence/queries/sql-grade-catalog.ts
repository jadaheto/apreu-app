import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { GradeCatalogPort } from '../../../domain/grade-catalog.port.js';

/** Reads `grades` (academic context). */
@Injectable()
export class SqlGradeCatalog implements GradeCatalogPort {
  constructor(private readonly db: TenantDataSource) {}

  async existingIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const rows: { id: number }[] = await (
      await this.db.manager()
    ).query('SELECT id FROM grades WHERE id = ANY($1)', [ids]);
    return rows.map((row) => Number(row.id));
  }
}
