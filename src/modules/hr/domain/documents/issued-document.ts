import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

export const ISSUED_DOCUMENT_TYPES = ['employment_certificate'] as const;
export type IssuedDocumentType = (typeof ISSUED_DOCUMENT_TYPES)[number];

export interface IssuedDocumentProps<TContent extends object = Record<string, unknown>> {
  code: string;
  type: IssuedDocumentType;
  employeeId: number;
  /** Frozen content of the document as issued. */
  content: TContent;
  issuedBy: number;
  issuedAt: Date;
}

/**
 * A certificate issued by HR with a unique verification code
 * (`hr_issued_documents`). Replaces the fake handwritten signature and the
 * unverifiable `APREU-{time()}` number of the legacy (S-15): anyone can check
 * the code against the school's records.
 */
export class IssuedDocument<TContent extends object = Record<string, unknown>> extends Entity<
  IssuedDocumentProps<TContent>
> {
  private constructor(id: EntityId, props: IssuedDocumentProps<TContent>) {
    super(id, props);
  }

  static issue<T extends object>(props: IssuedDocumentProps<T>): IssuedDocument<T> {
    Guard.againstEmpty(props.code, 'código de verificación');
    Guard.oneOf(props.type, ISSUED_DOCUMENT_TYPES, 'tipo de documento');
    return new IssuedDocument<T>(null, { ...props, content: structuredClone(props.content) });
  }

  static restore<T extends object>(id: number, props: IssuedDocumentProps<T>): IssuedDocument<T> {
    return new IssuedDocument<T>(id, { ...props });
  }

  get code(): string {
    return this.props.code;
  }
  get type(): IssuedDocumentType {
    return this.props.type;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get content(): TContent {
    return structuredClone(this.props.content);
  }
  get issuedBy(): number {
    return this.props.issuedBy;
  }
  get issuedAt(): Date {
    return this.props.issuedAt;
  }
}

/** Output port for {@link IssuedDocument}. */
export interface IssuedDocumentRepository {
  findByCode(code: string): Promise<IssuedDocument | null>;
  save(document: IssuedDocument<object>): Promise<void>;
}

export const ISSUED_DOCUMENT_REPOSITORY = Symbol('IssuedDocumentRepository');

/**
 * Verification codes are issued in upper case (`XXXX-XXXX-XXXX-XXXX`, see
 * `CryptoSecureRandom`) and printed on the certificate, so a code typed in
 * lower case or with surrounding spaces must still match (ADR-0008: PostgreSQL
 * compares case-sensitively, MariaDB `utf8mb4_general_ci` did not).
 */
export const normalizeVerificationCode = (raw: string): string => (raw ?? '').trim().toUpperCase();
