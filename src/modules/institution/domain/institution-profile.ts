import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Email } from '../../../shared/domain/value-objects/email.vo.js';
import { INSTITUTION_DOCUMENT_TYPES, Nit, type InstitutionDocumentType } from './nit.js';

export type InstitutionPersonType = 'natural' | 'juridica';
export const INSTITUTION_PERSON_TYPES: readonly InstitutionPersonType[] = ['natural', 'juridica'];

/** Editable data of the institution as received from the administrator. */
export interface InstitutionProfileData {
  name: string;
  nit: string;
  documentType: InstitutionDocumentType;
  personType: InstitutionPersonType;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  /** DANE municipality code (3 digits, or 5 including the department). */
  cityDaneCode?: string | null;
  department?: string | null;
  /** DANE department code (2 digits). */
  departmentDaneCode?: string | null;
  postalCode?: string | null;
  /** RUT box 53 codes, e.g. `O-13`, `R-99-PN`. */
  taxResponsibilities?: string[];
  /** Institutional DANE registry code of the school. */
  daneCode?: string | null;
  /** Approval resolution (Secretaría de Educación) printed on certificates. */
  resolutionNumber?: string | null;
  rectorName?: string | null;
  billingContactName?: string | null;
  billingContactPhone?: string | null;
  billingContactEmail?: string | null;
}

export interface InstitutionProfileProps {
  name: string;
  nit: Nit;
  documentType: InstitutionDocumentType;
  personType: InstitutionPersonType;
  address: string | null;
  phone: string | null;
  email: Email | null;
  city: string | null;
  cityDaneCode: string | null;
  department: string | null;
  departmentDaneCode: string | null;
  postalCode: string | null;
  taxResponsibilities: string[];
  daneCode: string | null;
  resolutionNumber: string | null;
  rectorName: string | null;
  billingContactName: string | null;
  billingContactPhone: string | null;
  billingContactEmail: Email | null;
  /** Storage key of the current logo. */
  logoPath: string | null;
}

const PHONE = /^[0-9+() -]{7,20}$/;
const TAX_CODE = /^[A-Z0-9]{1,3}(-[A-Z0-9]{1,4}){0,2}$/;

/** Trims; blank becomes null; enforces length and optional pattern. */
const optionalText = (
  value: string | null | undefined,
  field: string,
  max: number,
  pattern?: RegExp,
): string | null => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  Guard.againstMaxLength(trimmed, max, field);
  if (pattern && !pattern.test(trimmed)) {
    throw new BusinessRuleViolationError(`El campo "${field}" tiene un formato inválido.`, 'INVALID_FORMAT', { field });
  }
  return trimmed;
};

const optionalEmail = (value: string | null | undefined): Email | null => (value?.trim() ? Email.create(value) : null);

/**
 * Identity, location and tax data of the school (single row of
 * `institutions` plus the RUT fields of the legacy "Empresa / RUT" tab).
 * The NIT check digit is derived, never typed.
 */
export class InstitutionProfile extends Entity<InstitutionProfileProps> {
  private constructor(id: EntityId, props: InstitutionProfileProps) {
    super(id, props);
  }

  static create(data: InstitutionProfileData): InstitutionProfile {
    return new InstitutionProfile(null, { ...InstitutionProfile.validate(data), logoPath: null });
  }

  static restore(id: number | null, props: InstitutionProfileProps): InstitutionProfile {
    return new InstitutionProfile(id, { ...props, taxResponsibilities: [...props.taxResponsibilities] });
  }

  private static validate(data: InstitutionProfileData): Omit<InstitutionProfileProps, 'logoPath'> {
    const name = data.name?.trim();
    Guard.againstEmpty(name, 'razón social');
    Guard.againstMaxLength(name, 200, 'razón social');
    Guard.oneOf(data.documentType, INSTITUTION_DOCUMENT_TYPES, 'tipo de documento');
    Guard.oneOf(data.personType, INSTITUTION_PERSON_TYPES, 'tipo de persona');
    const taxResponsibilities = [
      ...new Set((data.taxResponsibilities ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean)),
    ];
    taxResponsibilities.forEach((code) => {
      if (!TAX_CODE.test(code)) {
        throw new BusinessRuleViolationError(`Responsabilidad tributaria inválida: "${code}".`, 'INVALID_FORMAT', {
          field: 'responsabilidades tributarias',
        });
      }
    });
    return {
      name,
      nit: Nit.create(data.nit, data.documentType),
      documentType: data.documentType,
      personType: data.personType,
      address: optionalText(data.address, 'dirección', 255),
      phone: optionalText(data.phone, 'teléfono', 20, PHONE),
      email: optionalEmail(data.email),
      city: optionalText(data.city, 'ciudad', 100),
      cityDaneCode: optionalText(data.cityDaneCode, 'código DANE del municipio', 5, /^\d{3}(\d{2})?$/),
      department: optionalText(data.department, 'departamento', 100),
      departmentDaneCode: optionalText(data.departmentDaneCode, 'código DANE del departamento', 2, /^\d{2}$/),
      postalCode: optionalText(data.postalCode, 'código postal', 6, /^\d{6}$/),
      taxResponsibilities,
      daneCode: optionalText(data.daneCode, 'código DANE de la institución', 20, /^\d{6,20}$/),
      resolutionNumber: optionalText(data.resolutionNumber, 'resolución de aprobación', 50),
      rectorName: optionalText(data.rectorName, 'rector(a)', 150),
      billingContactName: optionalText(data.billingContactName, 'contacto de facturación', 150),
      billingContactPhone: optionalText(data.billingContactPhone, 'teléfono de facturación', 20, PHONE),
      billingContactEmail: optionalEmail(data.billingContactEmail),
    };
  }

  /** Replaces every editable field (PUT semantics); the logo is kept. */
  update(data: InstitutionProfileData): void {
    Object.assign(this.props, InstitutionProfile.validate(data));
  }

  changeLogo(path: string): void {
    Guard.againstEmpty(path, 'logo');
    this.props.logoPath = path;
  }

  /** Read-only snapshot for mappers and views. */
  snapshot(): Readonly<InstitutionProfileProps> {
    return { ...this.props, taxResponsibilities: [...this.props.taxResponsibilities] };
  }

  get name(): string {
    return this.props.name;
  }
  get nit(): Nit {
    return this.props.nit;
  }
  get logoPath(): string | null {
    return this.props.logoPath;
  }
}
