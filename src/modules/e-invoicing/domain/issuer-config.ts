import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Email } from '../../../shared/domain/value-objects/email.vo.js';
import { DIAN_ENVIRONMENTS, type DianEnvironment, type VatRegime } from './catalogs.js';
import { FILE_NAMING_MODES, type FileNamingMode } from './file-naming.js';
import { computeDv, normalizeNit } from './nit.js';
import { assertLocation, type DaneLocation } from './party.js';

/** Persisted configuration of the electronic invoicing issuer (settings `dian_*`). */
export interface IssuerConfigProps {
  businessName: string;
  nit: string;
  /** `1` legal person, `2` natural person. */
  personType: '1' | '2';
  firstName: string | null;
  familyName: string | null;
  taxResponsibilities: string;
  vatRegime: VatRegime;
  address: string;
  location: DaneLocation;
  postalCode: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  softwareId: string;
  /** Secret: never returned by the API. */
  softwarePin: string;
  environment: DianEnvironment;
  /** TestSetId assigned by the DIAN for habilitation; enables `SendTestSetAsync`. */
  testSetId: string | null;
  /** Issue an invoice automatically for each payment registered in finance. */
  autoInvoiceOnPayment: boolean;
  fileNaming: FileNamingMode;
  /** Technology provider code for file names (`000` = own software). */
  providerCode: string;
}

export type IssuerConfigUpdate = Partial<Omit<IssuerConfigProps, 'softwarePin'>> & { softwarePin?: string | null };

/** Fields required before any document can be issued (legacy `generate_invoice.php:38-43` + diagnostics). */
const REQUIRED_FOR_ISSUING: readonly (keyof IssuerConfigProps)[] = [
  'businessName',
  'nit',
  'address',
  'softwareId',
  'softwarePin',
  'email',
];

/**
 * Issuer (school) data and DIAN software credentials.
 *
 * Rules:
 * - NIT digits only; its DV is always computed (legacy `dian_dv` mismatch bug).
 * - Responsibilities normalized to `O-xx;O-yy` (legacy `normalizeTaxResp`).
 * - Location must be a consistent DANE pair (CDG01).
 * - Natural persons need first and family names (`cac:Person`, FAK61).
 * - The software PIN is write-only: an update without PIN keeps the current one.
 */
export class IssuerConfig {
  private constructor(private props: IssuerConfigProps) {}

  /** Default (empty) configuration of a school that never configured DIAN. */
  static empty(): IssuerConfig {
    return new IssuerConfig({
      businessName: '',
      nit: '',
      personType: '1',
      firstName: null,
      familyName: null,
      taxResponsibilities: 'R-99-PN',
      vatRegime: '49',
      address: '',
      location: { cityCode: '', cityName: '', departmentCode: '', departmentName: '' },
      postalCode: null,
      contactName: null,
      phone: null,
      email: null,
      softwareId: '',
      softwarePin: '',
      environment: '2',
      testSetId: null,
      autoInvoiceOnPayment: false,
      fileNaming: 'annex',
      providerCode: '000',
    });
  }

  static restore(props: IssuerConfigProps): IssuerConfig {
    return new IssuerConfig({ ...props });
  }

  /** Applies a partial update and validates the resulting configuration. */
  update(changes: IssuerConfigUpdate): void {
    const { softwarePin, ...rest } = changes;
    const next: IssuerConfigProps = {
      ...this.props,
      ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
      softwarePin: softwarePin?.trim() ? softwarePin.trim() : this.props.softwarePin,
    };
    this.props = IssuerConfig.validate(next);
  }

  private static validate(props: IssuerConfigProps): IssuerConfigProps {
    const businessName = props.businessName?.trim();
    Guard.againstEmpty(businessName, 'razón social');
    Guard.againstMaxLength(businessName, 255, 'razón social');
    Guard.oneOf(props.personType, ['1', '2'] as const, 'tipo de persona');
    Guard.oneOf(props.environment, DIAN_ENVIRONMENTS, 'ambiente');
    Guard.oneOf(props.vatRegime, ['48', '49'] as const, 'régimen de IVA');
    Guard.oneOf(props.fileNaming, FILE_NAMING_MODES, 'nombres de archivo');
    if (!/^\d{3}$/.test(props.providerCode)) {
      throw new BusinessRuleViolationError(
        'El código de proveedor tecnológico debe tener 3 dígitos.',
        'INVALID_PROVIDER_CODE',
      );
    }
    assertLocation(props.location);
    if (props.personType === '2' && (!props.firstName?.trim() || !props.familyName?.trim())) {
      throw new BusinessRuleViolationError(
        'Una persona natural requiere nombres y apellidos.',
        'PERSON_NAMES_REQUIRED',
      );
    }
    if (props.softwareId && !/^[0-9a-fA-F-]{8,64}$/.test(props.softwareId)) {
      throw new BusinessRuleViolationError('El identificador del software no es válido.', 'INVALID_SOFTWARE_ID');
    }
    return {
      ...props,
      businessName,
      nit: normalizeNit(props.nit),
      email: props.email ? Email.create(props.email).toString() : null,
      taxResponsibilities: normalizeTaxResponsibilities(props.taxResponsibilities),
      testSetId: props.testSetId?.trim() || null,
      address: props.address?.trim() ?? '',
    };
  }

  get businessName(): string {
    return this.props.businessName;
  }
  get nit(): string {
    return this.props.nit;
  }
  get dv(): string {
    return computeDv(this.props.nit);
  }
  get personType(): '1' | '2' {
    return this.props.personType;
  }
  get firstName(): string {
    return this.props.firstName ?? this.props.businessName.split(/\s+/)[0];
  }
  get familyName(): string {
    return this.props.familyName ?? this.props.businessName.split(/\s+/).slice(1).join(' ');
  }
  get taxResponsibilities(): string {
    return this.props.taxResponsibilities;
  }
  get vatRegime(): VatRegime {
    return this.props.vatRegime;
  }
  get address(): string {
    return this.props.address;
  }
  get location(): DaneLocation {
    return this.props.location;
  }
  get postalCode(): string | null {
    return this.props.postalCode;
  }
  get contactName(): string {
    return this.props.contactName ?? this.props.businessName;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get email(): string | null {
    return this.props.email;
  }
  get softwareId(): string {
    return this.props.softwareId;
  }
  get softwarePin(): string {
    return this.props.softwarePin;
  }
  get environment(): DianEnvironment {
    return this.props.environment;
  }
  get testSetId(): string | null {
    return this.props.testSetId;
  }
  /** Habilitation with a TestSetId: documents go through `SendTestSetAsync`. */
  get usesTestSet(): boolean {
    return this.props.environment === '2' && Boolean(this.props.testSetId);
  }
  get autoInvoiceOnPayment(): boolean {
    return this.props.autoInvoiceOnPayment;
  }
  get fileNaming(): FileNamingMode {
    return this.props.fileNaming;
  }
  get providerCode(): string {
    return this.props.providerCode;
  }

  /** Names of the required fields that are still empty. */
  missingFields(): string[] {
    return REQUIRED_FOR_ISSUING.filter((field) => !this.props[field]);
  }

  /** Fails when the configuration is incomplete for issuing documents. */
  assertReadyToIssue(): void {
    const missing = this.missingFields();
    if (missing.length || !this.props.location.cityCode) {
      throw new BusinessRuleViolationError(
        'La configuración de facturación electrónica está incompleta.',
        'E_INVOICING_NOT_CONFIGURED',
        { missing: missing.length ? missing : ['location'] },
      );
    }
  }

  toProps(): IssuerConfigProps {
    return { ...this.props, location: { ...this.props.location } };
  }
}

/**
 * Normalizes fiscal responsibilities (legacy `normalizeTaxResp`): values that
 * already look like `O-xx`/`R-xx-xx` are kept; bare 2-digit codes become
 * `O-xx`; nothing valid → `R-99-PN`. Entries are joined with `;`.
 */
export function normalizeTaxResponsibilities(raw: string | null | undefined): string {
  const tokens = (raw ?? '')
    .split(/[;,\s]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .flatMap((token) => {
      if (/^(O-\d{2}|R-\d{2}-P[NJ])$/.test(token)) return [token];
      return (token.match(/\d{2}/g) ?? []).map((digits) => `O-${digits}`);
    });
  return tokens.length ? [...new Set(tokens)].join(';') : 'R-99-PN';
}
