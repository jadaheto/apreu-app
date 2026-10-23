import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { IDENTIFICATION_TYPES, isCatalogCode, NIT_ID_TYPE, type VatRegime } from './catalogs.js';
import { computeDv } from './nit.js';

/** DANE location (department + municipality). */
export interface DaneLocation {
  cityCode: string;
  cityName: string;
  departmentCode: string;
  departmentName: string;
}

export interface PartyProps {
  name: string;
  idType: string;
  idNumber: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  location: DaneLocation;
  /** Fiscal responsibilities (`TaxLevelCode`), e.g. `R-99-PN` or `O-13;O-15`. */
  taxLevelCode: string;
  vatRegime: VatRegime;
  firstName?: string | null;
  familyName?: string | null;
}

/** Placeholder buyer used when the payer is unknown (DIAN "consumidor final"). */
export const FINAL_CONSUMER = { name: 'Consumidor Final', idType: '13', idNumber: '222222222222' } as const;

/**
 * Acquirer of an electronic document (`AccountingCustomerParty`).
 *
 * Rules:
 * - The identification type must belong to the DIAN catalog.
 * - For NIT (31) the check digit is always computed, never trusted from input.
 * - Natural persons (any type other than NIT) carry first/family names so the
 *   `cac:Person` group is emitted (fixes legacy rejection FAK61).
 * - The municipality code must start with the department code (CDG01).
 */
export class Party {
  private constructor(private readonly props: PartyProps) {
    Object.freeze(this);
  }

  static create(input: PartyProps): Party {
    const name = input.name?.trim();
    Guard.againstEmpty(name, 'nombre del adquiriente');
    Guard.againstMaxLength(name, 255, 'nombre del adquiriente');
    if (!isCatalogCode(IDENTIFICATION_TYPES, input.idType)) {
      throw new BusinessRuleViolationError(`Tipo de identificación no válido: ${input.idType}.`, 'INVALID_ID_TYPE');
    }
    const idNumber = (input.idNumber ?? '').replace(/[\s.]/g, '').split('-')[0];
    if (!/^[A-Za-z0-9]{3,30}$/.test(idNumber)) {
      throw new BusinessRuleViolationError('Número de identificación del adquiriente inválido.', 'INVALID_ID_NUMBER');
    }
    assertLocation(input.location);
    return new Party({
      ...input,
      name,
      idNumber,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      taxLevelCode: input.taxLevelCode?.trim() || 'R-99-PN',
    });
  }

  /** Rebuilds a stored party without re-validating (legacy rows may lack data). */
  static restore(props: PartyProps): Party {
    return new Party({ ...props });
  }

  get name(): string {
    return this.props.name;
  }
  get idType(): string {
    return this.props.idType;
  }
  get idNumber(): string {
    return this.props.idNumber;
  }
  /** Check digit, only for NIT. */
  get dv(): string | null {
    return this.props.idType === NIT_ID_TYPE ? computeDv(this.props.idNumber) : null;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get address(): string | null {
    return this.props.address;
  }
  get location(): DaneLocation {
    return this.props.location;
  }
  get taxLevelCode(): string {
    return this.props.taxLevelCode;
  }
  get vatRegime(): VatRegime {
    return this.props.vatRegime;
  }
  /** `1` legal person (NIT), `2` natural person. */
  get personType(): '1' | '2' {
    return this.props.idType === NIT_ID_TYPE ? '1' : '2';
  }
  get firstName(): string {
    return this.props.firstName?.trim() || this.props.name.split(/\s+/)[0];
  }
  get familyName(): string {
    const rest = this.props.name.split(/\s+/).slice(1).join(' ');
    return this.props.familyName?.trim() || rest || this.firstName;
  }

  toProps(): PartyProps {
    return { ...this.props };
  }
}

/** Validates a DANE location (CDG01: the municipality belongs to the department). */
export function assertLocation(location: DaneLocation): void {
  if (!/^\d{5}$/.test(location?.cityCode ?? '') || !/^\d{2}$/.test(location?.departmentCode ?? '')) {
    throw new BusinessRuleViolationError(
      'Código DANE de municipio (5 dígitos) o departamento (2 dígitos) inválido.',
      'INVALID_DANE_CODE',
    );
  }
  if (!location.cityCode.startsWith(location.departmentCode)) {
    throw new BusinessRuleViolationError(
      'El municipio no pertenece al departamento indicado (CDG01).',
      'INVALID_DANE_CODE',
    );
  }
  Guard.againstEmpty(location.cityName, 'municipio');
  Guard.againstEmpty(location.departmentName, 'departamento');
}
