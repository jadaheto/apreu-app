import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { InstitutionProfile, InstitutionProfilePort } from '../../domain/documents/institution-profile.port.js';

const KEYS = ['school_name', 'school_nit', 'school_nit_dv', 'school_city', 'school_address', 'rector_name', 'logo'];

/** Reads the school profile from `settings` (owned by identity/configuration) with plain SQL. */
@Injectable()
export class SqlInstitutionProfile implements InstitutionProfilePort {
  constructor(private readonly db: TenantDataSource) {}

  async get(): Promise<InstitutionProfile> {
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query('SELECT key, value FROM settings WHERE key = ANY($1::varchar[])', [KEYS]);
    const value = (key: string) => rows.find((r) => r.key === key)?.value?.trim() || null;
    return {
      name: value('school_name') ?? 'Institución educativa',
      nit: value('school_nit'),
      nitVerificationDigit: value('school_nit_dv'),
      city: value('school_city'),
      address: value('school_address'),
      rectorName: value('rector_name'),
      logo: value('logo'),
    };
  }
}
