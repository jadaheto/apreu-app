import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { CertificateConceptCatalogPort } from '../../domain/certificate-concept-catalog.port.js';

/** Read-only SQL adapter over `billing_concepts` (finance context). */
@Injectable()
export class SqlCertificateConceptCatalog implements CertificateConceptCatalogPort {
  constructor(private readonly db: TenantDataSource) {}

  async certificateConceptIds(conceptIds: number[]): Promise<number[]> {
    if (conceptIds.length === 0) return [];
    const rows: { id: number }[] = await (
      await this.db.manager()
    ).query(
      `SELECT id FROM billing_concepts WHERE id = ANY($1) AND (category = 'certificado' OR f_unaccent(name) ILIKE '%certificado%')`,
      [conceptIds],
    );
    return rows.map((row) => Number(row.id));
  }
}
