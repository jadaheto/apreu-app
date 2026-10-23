import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AcademicSettingsPort, InstitutionProfile } from '../domain/academic-settings.port.js';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR } from '../domain/academic-year.js';
import { schoolDateOf, yearOfDate } from '../domain/school-calendar.js';

const INSTITUTION_KEYS = ['school_name', 'school_nit', 'school_address', 'logo'];
const DEFAULT_SCHOOL_NAME = 'Institución Educativa';

/** Reads the key/value `settings` table (owned by the identity/configuration context). */
@Injectable()
export class SqlAcademicSettings implements AcademicSettingsPort {
  constructor(
    private readonly db: TenantDataSource,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async currentAcademicYear(): Promise<number> {
    const values = await this.read(['academic_year']);
    const configured = Number.parseInt(values.get('academic_year') ?? '', 10);
    const isValid = Number.isInteger(configured) && configured >= MIN_ACADEMIC_YEAR && configured <= MAX_ACADEMIC_YEAR;
    return isValid ? configured : yearOfDate(schoolDateOf(this.clock.now()));
  }

  async institutionProfile(): Promise<InstitutionProfile> {
    const values = await this.read(INSTITUTION_KEYS);
    const optional = (key: string) => values.get(key)?.trim() || null;
    return {
      name: optional('school_name') ?? DEFAULT_SCHOOL_NAME,
      nit: optional('school_nit'),
      address: optional('school_address'),
      logo: optional('logo'),
    };
  }

  private async read(keys: string[]): Promise<Map<string, string>> {
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
    return new Map(rows.map((row) => [row.key, row.value ?? '']));
  }
}
