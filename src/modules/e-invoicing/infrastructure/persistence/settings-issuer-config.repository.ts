import { Inject, Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { DianEnvironment, VatRegime } from '../../domain/catalogs.js';
import type { FileNamingMode } from '../../domain/file-naming.js';
import { IssuerConfig, type IssuerConfigProps } from '../../domain/issuer-config.js';
import type { IssuerConfigRepository } from '../../domain/issuer-config.repository.js';
import { SECRET_CIPHER, type SecretCipher } from './secret-cipher.js';

/** `settings` keys (legacy names kept for compatibility with existing schools). */
const KEYS = {
  businessName: 'dian_business_name',
  nit: 'dian_nit',
  dv: 'dian_dv',
  idTypeCode: 'dian_id_type_code',
  personType: 'dian_person_type',
  firstName: 'dian_first_name',
  familyName: 'dian_family_name',
  taxResponsibilities: 'dian_tax_responsibilities',
  vatRegime: 'dian_vat_regime',
  address: 'dian_address',
  cityCode: 'dian_city_code',
  cityName: 'dian_city',
  departmentCode: 'dian_department_code',
  departmentName: 'dian_department',
  postalCode: 'dian_postal_code',
  contactName: 'dian_contact_name',
  phone: 'dian_phone',
  email: 'dian_email',
  softwareId: 'dian_software_id',
  softwarePin: 'dian_software_pin',
  environment: 'dian_environment',
  testSetId: 'dian_test_set_id',
  autoInvoiceOnPayment: 'dian_auto_invoice_on_payment',
  fileNaming: 'dian_file_naming',
  providerCode: 'dian_provider_code',
} as const;

/**
 * Issuer configuration stored as key/value rows in `settings` (as the legacy
 * `settings.php`). Raw SQL is used so this context does not map the shared
 * `settings` table as an entity. The software PIN is encrypted at rest.
 */
@Injectable()
export class SettingsIssuerConfigRepository implements IssuerConfigRepository {
  constructor(
    private readonly db: TenantDataSource,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  async get(): Promise<IssuerConfig> {
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query("SELECT key, value FROM settings WHERE key LIKE 'dian\\_%'");
    const values = new Map(rows.map((row) => [row.key, row.value?.trim() ?? '']));
    const text = (key: string): string => values.get(key) ?? '';
    const optional = (key: string): string | null => text(key) || null;
    const defaults = IssuerConfig.empty().toProps();

    const props: IssuerConfigProps = {
      businessName: text(KEYS.businessName),
      nit: text(KEYS.nit),
      personType: text(KEYS.personType) === '2' ? '2' : '1',
      firstName: optional(KEYS.firstName),
      familyName: optional(KEYS.familyName),
      taxResponsibilities: text(KEYS.taxResponsibilities) || defaults.taxResponsibilities,
      vatRegime: (text(KEYS.vatRegime) || defaults.vatRegime) as VatRegime,
      address: text(KEYS.address),
      location: {
        cityCode: text(KEYS.cityCode),
        cityName: text(KEYS.cityName),
        departmentCode: text(KEYS.departmentCode),
        departmentName: text(KEYS.departmentName),
      },
      postalCode: optional(KEYS.postalCode),
      contactName: optional(KEYS.contactName),
      phone: optional(KEYS.phone),
      email: optional(KEYS.email),
      softwareId: text(KEYS.softwareId),
      softwarePin: text(KEYS.softwarePin) ? this.cipher.decrypt(text(KEYS.softwarePin)) : '',
      environment: (text(KEYS.environment) === '1' ? '1' : '2') as DianEnvironment,
      testSetId: optional(KEYS.testSetId),
      autoInvoiceOnPayment: text(KEYS.autoInvoiceOnPayment) === '1',
      fileNaming: (text(KEYS.fileNaming) === 'legacy' ? 'legacy' : 'annex') as FileNamingMode,
      providerCode: text(KEYS.providerCode) || defaults.providerCode,
    };
    return IssuerConfig.restore(props);
  }

  async save(config: IssuerConfig): Promise<void> {
    const props = config.toProps();
    const entries: [string, string][] = [
      [KEYS.businessName, props.businessName],
      [KEYS.nit, props.nit],
      [KEYS.dv, config.dv],
      [KEYS.idTypeCode, '31'],
      [KEYS.personType, props.personType],
      [KEYS.firstName, props.firstName ?? ''],
      [KEYS.familyName, props.familyName ?? ''],
      [KEYS.taxResponsibilities, props.taxResponsibilities],
      [KEYS.vatRegime, props.vatRegime],
      [KEYS.address, props.address],
      [KEYS.cityCode, props.location.cityCode],
      [KEYS.cityName, props.location.cityName],
      [KEYS.departmentCode, props.location.departmentCode],
      [KEYS.departmentName, props.location.departmentName],
      [KEYS.postalCode, props.postalCode ?? ''],
      [KEYS.contactName, props.contactName ?? ''],
      [KEYS.phone, props.phone ?? ''],
      [KEYS.email, props.email ?? ''],
      [KEYS.softwareId, props.softwareId],
      [KEYS.softwarePin, props.softwarePin ? this.cipher.encrypt(props.softwarePin) : ''],
      [KEYS.environment, props.environment],
      [KEYS.testSetId, props.testSetId ?? ''],
      [KEYS.autoInvoiceOnPayment, props.autoInvoiceOnPayment ? '1' : '0'],
      [KEYS.fileNaming, props.fileNaming],
      [KEYS.providerCode, props.providerCode],
    ];
    // One atomic upsert for every key (`settings.key` is the primary key).
    await (
      await this.db.manager()
    ).query(
      `INSERT INTO settings (key, value)
       SELECT * FROM unnest($1::varchar[], $2::text[])
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [entries.map(([key]) => key), entries.map(([, value]) => value)],
    );
  }
}
