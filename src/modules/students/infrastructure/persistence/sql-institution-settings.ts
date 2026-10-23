import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { InstitutionProfile, InstitutionSettingsPort } from '../../domain/institution-settings.port.js';

const KEYS = [
  'school_name',
  'school_nit',
  'school_city',
  'rector_name',
  'academic_year',
  'logo',
  'logo_size',
  'signature',
];

/** Reads the institutional `settings` keys with the legacy defaults (`students/portal.php`). */
@Injectable()
export class SqlInstitutionSettings implements InstitutionSettingsPort {
  constructor(private readonly db: TenantDataSource) {}

  async load(): Promise<InstitutionProfile> {
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query('SELECT key, value FROM settings WHERE key = ANY($1)', [KEYS]);
    const values = new Map(rows.map((row) => [row.key, row.value?.trim() || null]));
    const year = Number(values.get('academic_year'));
    const logoSize = Number(values.get('logo_size'));
    return {
      schoolName: values.get('school_name') ?? 'Institución Educativa Apreu',
      nit: values.get('school_nit') ?? '---',
      city: values.get('school_city') ?? 'Colombia',
      rectorName: values.get('rector_name') ?? 'Rector(a)',
      academicYear: Number.isInteger(year) && year > 2000 ? year : null,
      logo: values.get('logo') ?? null,
      logoSize: Number.isFinite(logoSize) && logoSize > 0 ? logoSize : 40,
      signature: values.get('signature') ?? null,
    };
  }
}
