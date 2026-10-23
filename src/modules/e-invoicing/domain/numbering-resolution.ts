import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { DIAN_ENVIRONMENTS, DOCUMENT_TYPES, type DianEnvironment, type DocumentType } from './catalogs.js';

export interface NumberingResolutionProps {
  docType: DocumentType;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  /** Last consecutive used (`range_from - 1` when none). */
  current: number;
  resolutionNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  /** Secret technical key of an invoice resolution (CUFE). */
  technicalKey: string | null;
  environment: DianEnvironment;
  /** Incremented when habilitation numbering is reset, so numbers stay unique without deleting documents. */
  cycle: number;
  active: boolean;
}

export interface RegisterResolutionInput {
  docType: DocumentType;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  resolutionNumber?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  technicalKey?: string | null;
  environment: DianEnvironment;
}

export interface ResolutionChanges {
  rangeTo?: number;
  validFrom?: string | null;
  validTo?: string | null;
  technicalKey?: string | null;
  resolutionNumber?: string | null;
  active?: boolean;
}

/** A reserved document number. */
export interface ReservedNumber {
  prefix: string;
  consecutive: number;
  cycle: number;
  /** `prefix + consecutive` without zero padding (legacy format, e.g. `SETP990000001`). */
  number: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Numbering range of one document type (`dian_consecutives`).
 *
 * Rules:
 * - Invoices (FV) need the DIAN resolution number, validity and technical key.
 * - Credit and debit notes have their **own** prefix and range; they never
 *   share the invoice numbering (legacy bug: NC/ND reused the FV prefix).
 * - `reserveNext` is called while the row is locked (`SELECT … FOR UPDATE`
 *   inside a transaction) and validates range and validity dates.
 * - Prefixes are 1–4 alphanumeric characters (DIAN).
 */
export class NumberingResolution extends Entity<NumberingResolutionProps> {
  private constructor(id: EntityId, props: NumberingResolutionProps) {
    super(id, props);
  }

  static register(input: RegisterResolutionInput): NumberingResolution {
    Guard.oneOf(input.docType, DOCUMENT_TYPES, 'tipo de documento');
    Guard.oneOf(input.environment, DIAN_ENVIRONMENTS, 'ambiente');
    const prefix = (input.prefix ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,4}$/.test(prefix)) {
      throw new BusinessRuleViolationError(
        'El prefijo debe tener entre 1 y 4 caracteres alfanuméricos.',
        'INVALID_PREFIX',
      );
    }
    if (
      !Number.isInteger(input.rangeFrom) ||
      input.rangeFrom < 1 ||
      !Number.isInteger(input.rangeTo) ||
      input.rangeTo < input.rangeFrom
    ) {
      throw new BusinessRuleViolationError('El rango de numeración es inválido.', 'INVALID_RANGE');
    }
    const resolution = new NumberingResolution(null, {
      docType: input.docType,
      prefix,
      rangeFrom: input.rangeFrom,
      rangeTo: input.rangeTo,
      current: input.rangeFrom - 1,
      resolutionNumber: input.resolutionNumber?.trim() || null,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      technicalKey: input.technicalKey?.trim() || null,
      environment: input.environment,
      cycle: 0,
      active: true,
    });
    resolution.assertConsistent();
    return resolution;
  }

  static restore(id: number, props: NumberingResolutionProps): NumberingResolution {
    return new NumberingResolution(id, { ...props });
  }

  get docType(): DocumentType {
    return this.props.docType;
  }
  get prefix(): string {
    return this.props.prefix;
  }
  get rangeFrom(): number {
    return this.props.rangeFrom;
  }
  get rangeTo(): number {
    return this.props.rangeTo;
  }
  get current(): number {
    return this.props.current;
  }
  get resolutionNumber(): string | null {
    return this.props.resolutionNumber;
  }
  get validFrom(): string | null {
    return this.props.validFrom;
  }
  get validTo(): string | null {
    return this.props.validTo;
  }
  get technicalKey(): string | null {
    return this.props.technicalKey;
  }
  get environment(): DianEnvironment {
    return this.props.environment;
  }
  get cycle(): number {
    return this.props.cycle;
  }
  get isActive(): boolean {
    return this.props.active;
  }
  get remaining(): number {
    return this.props.rangeTo - this.props.current;
  }

  /** Applies administrative changes (extend range, renew dates, rotate key, (de)activate). */
  change(changes: ResolutionChanges): void {
    if (changes.rangeTo !== undefined) {
      if (!Number.isInteger(changes.rangeTo) || changes.rangeTo < Math.max(this.props.current, this.props.rangeFrom)) {
        throw new BusinessRuleViolationError(
          'El nuevo límite del rango no puede ser menor al último número usado.',
          'INVALID_RANGE',
        );
      }
      this.props.rangeTo = changes.rangeTo;
    }
    if (changes.validFrom !== undefined) this.props.validFrom = changes.validFrom;
    if (changes.validTo !== undefined) this.props.validTo = changes.validTo;
    if (changes.technicalKey) this.props.technicalKey = changes.technicalKey.trim();
    if (changes.resolutionNumber !== undefined) this.props.resolutionNumber = changes.resolutionNumber?.trim() || null;
    if (changes.active !== undefined) this.props.active = changes.active;
    this.assertConsistent();
  }

  deactivate(): void {
    this.props.active = false;
  }

  /**
   * Takes the next number. Must run inside the transaction that locked the row.
   * @param issueDate Bogotá date of the document (`YYYY-MM-DD`).
   */
  reserveNext(issueDate: string, environment: DianEnvironment): ReservedNumber {
    if (!this.props.active) {
      throw new BusinessRuleViolationError('La resolución de numeración está inactiva.', 'RESOLUTION_INACTIVE');
    }
    if (this.props.environment !== environment) {
      // Prevents FAD05e/FAD06: production documents with habilitation ranges/keys or vice versa.
      throw new BusinessRuleViolationError(
        'La resolución de numeración no corresponde al ambiente DIAN configurado.',
        'RESOLUTION_ENVIRONMENT_MISMATCH',
      );
    }
    if (
      (this.props.validFrom && issueDate < this.props.validFrom) ||
      (this.props.validTo && issueDate > this.props.validTo)
    ) {
      throw new BusinessRuleViolationError(
        'La resolución de numeración no está vigente para la fecha de emisión.',
        'RESOLUTION_EXPIRED',
      );
    }
    const next = Math.max(this.props.current + 1, this.props.rangeFrom);
    if (next > this.props.rangeTo) {
      throw new BusinessRuleViolationError('Se agotó el rango de numeración autorizado.', 'NUMBERING_RANGE_EXHAUSTED', {
        prefix: this.props.prefix,
        rangeTo: this.props.rangeTo,
      });
    }
    this.props.current = next;
    return {
      prefix: this.props.prefix,
      consecutive: next,
      cycle: this.props.cycle,
      number: `${this.props.prefix}${next}`,
    };
  }

  /** Habilitation only: restarts the range in a new numbering cycle; previous documents are kept. */
  resetForHabilitation(): void {
    if (this.props.environment !== '2') {
      throw new BusinessRuleViolationError(
        'Solo se puede reiniciar la numeración de habilitación.',
        'RESET_NOT_ALLOWED',
      );
    }
    this.props.current = this.props.rangeFrom - 1;
    this.props.cycle += 1;
  }

  private assertConsistent(): void {
    for (const [field, value] of [
      ['vigencia desde', this.props.validFrom],
      ['vigencia hasta', this.props.validTo],
    ] as const) {
      if (value !== null && !DAY.test(value)) {
        throw new BusinessRuleViolationError(`Fecha inválida en "${field}" (AAAA-MM-DD).`, 'INVALID_DATE');
      }
    }
    if (this.props.validFrom && this.props.validTo && this.props.validTo < this.props.validFrom) {
      throw new BusinessRuleViolationError('La vigencia final no puede ser anterior a la inicial.', 'INVERTED_DATES');
    }
    if (this.props.docType === 'fv') {
      if (!this.props.resolutionNumber || !this.props.validFrom || !this.props.validTo || !this.props.technicalKey) {
        throw new BusinessRuleViolationError(
          'Una resolución de facturación requiere número, vigencia y clave técnica.',
          'INCOMPLETE_RESOLUTION',
        );
      }
    }
  }
}
