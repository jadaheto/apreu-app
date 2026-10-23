import { Email } from '../../../../shared/domain/value-objects/email.vo.js';
import {
  INSTITUTION_PERSON_TYPES,
  InstitutionProfile,
  type InstitutionPersonType,
} from '../../domain/institution-profile.js';
import { calculateNitDv, INSTITUTION_DOCUMENT_TYPES, Nit, type InstitutionDocumentType } from '../../domain/nit.js';
import { InstitutionOrmEntity } from './institution.orm-entity.js';

/**
 * Settings that complete the profile (RUT fields with no column in
 * `institutions`) and legacy keys mirrored for consumers that still read the
 * institution data from `settings` (certificates, payslips, bulletins…).
 */
export const PROFILE_SETTING_KEYS = {
  name: 'school_name',
  nit: 'school_nit',
  nitDv: 'school_nit_dv',
  documentType: 'school_doc_type',
  personType: 'school_person_type',
  department: 'school_department',
  departmentDaneCode: 'school_dept_dane',
  city: 'school_city',
  cityDaneCode: 'school_city_dane',
  address: 'school_address',
  postalCode: 'school_postal',
  taxResponsibilities: 'school_tax_responsibilities',
  billingContactName: 'billing_contact_name',
  billingContactPhone: 'billing_contact_phone',
  billingContactEmail: 'billing_contact_email',
  rectorName: 'rector_name',
  logo: 'logo',
} as const;

type SettingsMap = ReadonlyMap<string, string | null>;

const text = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

const lenientEmail = (value: string | null | undefined): Email | null => {
  try {
    return value?.trim() ? Email.create(value) : null;
  } catch {
    return null;
  }
};

/** Legacy values like `900.123.456-7` are reduced to digits; the DV is recalculated when possible. */
const lenientNit = (raw: string, documentType: InstitutionDocumentType, storedDv: string | null): Nit => {
  const digits = (raw.split('-')[0] ?? '').replace(/\D/g, '');
  if (documentType === 'CC') return Nit.restore(digits, null);
  try {
    return Nit.restore(digits, calculateNitDv(digits));
  } catch {
    return Nit.restore(digits, storedDv && /^\d$/.test(storedDv) ? Number(storedDv) : null);
  }
};

/** Translates between `institutions` + `settings` and {@link InstitutionProfile}. */
export const InstitutionProfileMapper = {
  /** `null` when neither the row nor the legacy `school_name` setting exist. */
  toDomain(row: InstitutionOrmEntity | null, settings: SettingsMap): InstitutionProfile | null {
    const setting = (key: string) => text(settings.get(key));
    const name = text(row?.name) ?? setting(PROFILE_SETTING_KEYS.name);
    if (!name) return null;

    const storedType = setting(PROFILE_SETTING_KEYS.documentType)?.toUpperCase() as InstitutionDocumentType | undefined;
    const documentType = storedType && INSTITUTION_DOCUMENT_TYPES.includes(storedType) ? storedType : 'NIT';
    const storedPerson = setting(PROFILE_SETTING_KEYS.personType) as InstitutionPersonType | null;
    const personType = storedPerson && INSTITUTION_PERSON_TYPES.includes(storedPerson) ? storedPerson : 'juridica';

    return InstitutionProfile.restore(row?.id ?? null, {
      name,
      nit: lenientNit(
        text(row?.nit) ?? setting(PROFILE_SETTING_KEYS.nit) ?? '',
        documentType,
        setting(PROFILE_SETTING_KEYS.nitDv),
      ),
      documentType,
      personType,
      address: text(row?.address) ?? setting(PROFILE_SETTING_KEYS.address),
      phone: text(row?.phone),
      email: lenientEmail(row?.email),
      city: text(row?.city) ?? setting(PROFILE_SETTING_KEYS.city),
      cityDaneCode: setting(PROFILE_SETTING_KEYS.cityDaneCode),
      department: text(row?.department) ?? setting(PROFILE_SETTING_KEYS.department),
      departmentDaneCode: setting(PROFILE_SETTING_KEYS.departmentDaneCode),
      postalCode: setting(PROFILE_SETTING_KEYS.postalCode),
      taxResponsibilities: (setting(PROFILE_SETTING_KEYS.taxResponsibilities) ?? '')
        .split(/[,;]/)
        .map((code) => code.trim())
        .filter(Boolean),
      daneCode: text(row?.daneCode),
      resolutionNumber: text(row?.resolutionNo),
      rectorName: text(row?.rectorName) ?? setting(PROFILE_SETTING_KEYS.rectorName),
      billingContactName: setting(PROFILE_SETTING_KEYS.billingContactName),
      billingContactPhone: setting(PROFILE_SETTING_KEYS.billingContactPhone),
      billingContactEmail: lenientEmail(setting(PROFILE_SETTING_KEYS.billingContactEmail)),
      logoPath: text(row?.logo) ?? setting(PROFILE_SETTING_KEYS.logo),
    });
  },

  toRow(profile: InstitutionProfile): InstitutionOrmEntity {
    const p = profile.snapshot();
    const row = new InstitutionOrmEntity();
    if (profile.id !== null) row.id = profile.id;
    row.name = p.name;
    row.nit = p.nit.number;
    row.address = p.address;
    row.phone = p.phone;
    row.email = p.email?.toString() ?? null;
    row.logo = p.logoPath;
    row.daneCode = p.daneCode;
    row.resolutionNo = p.resolutionNumber;
    row.rectorName = p.rectorName;
    row.city = p.city;
    row.department = p.department;
    return row;
  },

  toSettings(profile: InstitutionProfile): Map<string, string | null> {
    const p = profile.snapshot();
    const k = PROFILE_SETTING_KEYS;
    return new Map<string, string | null>([
      [k.name, p.name],
      [k.nit, p.nit.number],
      [k.nitDv, p.nit.dv === null ? null : String(p.nit.dv)],
      [k.documentType, p.documentType],
      [k.personType, p.personType],
      [k.department, p.department],
      [k.departmentDaneCode, p.departmentDaneCode],
      [k.city, p.city],
      [k.cityDaneCode, p.cityDaneCode],
      [k.address, p.address],
      [k.postalCode, p.postalCode],
      [k.taxResponsibilities, p.taxResponsibilities.length ? p.taxResponsibilities.join(',') : null],
      [k.billingContactName, p.billingContactName],
      [k.billingContactPhone, p.billingContactPhone],
      [k.billingContactEmail, p.billingContactEmail?.toString() ?? null],
      [k.rectorName, p.rectorName],
      [k.logo, p.logoPath],
    ]);
  },
};
