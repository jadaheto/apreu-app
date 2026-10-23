import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { optionalText } from './catalogs.js';

/** Certificate kinds (`certificates.type`, free `VARCHAR(80)` in the schema). */
export const CERTIFICATE_TYPES = ['certificado_estudiantil'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_STATUSES = ['pending', 'approved', 'generated', 'cancelled'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

/**
 * Student data frozen at issuance. Legacy printed the *current* data of the
 * student (analysis 03 §2.7); the snapshot keeps the issued document stable.
 */
export interface CertificateSnapshot {
  studentName: string;
  studentCode: string;
  documentType: string;
  documentNumber: string | null;
  gradeName: string | null;
  classroomName: string | null;
  academicYear: number;
  studentStatus: string;
  enrollmentDate: string | null;
}

export interface CertificateProps {
  studentId: number;
  type: CertificateType;
  status: CertificateStatus;
  paymentId: number | null;
  generatedAt: Date | null;
  pdfPath: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: Date | null;
  /** Public verification code (migration `students-001`). */
  verificationCode: string | null;
  snapshot: CertificateSnapshot | null;
}

export interface IssueCertificateProps {
  studentId: number;
  type?: CertificateType;
  paymentId?: number | null;
  createdBy: number | null;
  verificationCode: string;
  snapshot: CertificateSnapshot;
  notes?: string | null;
  issuedAt: Date;
}

export interface RequestCertificateProps {
  studentId: number;
  type?: CertificateType;
  requestedBy: number;
  notes?: string | null;
  requestedAt: Date;
}

/**
 * Study certificate (`certificates` table; `student_certificates` is a dead
 * legacy table and is not used).
 *
 * - Issued `approved` automatically when a certificate charge is paid
 *   (legacy `finance/cashier.php:96-115`) or manually by the school office.
 * - Students/guardians may request one (`pending`) and the office approves it.
 * - Only `approved`/`generated` certificates can be printed.
 */
export class Certificate extends Entity<CertificateProps> {
  private constructor(id: EntityId, props: CertificateProps) {
    super(id, props);
  }

  static issue(input: IssueCertificateProps): Certificate {
    const type = input.type ?? 'certificado_estudiantil';
    Guard.oneOf(type, CERTIFICATE_TYPES, 'tipo de certificado');
    Guard.againstEmpty(input.verificationCode, 'código de verificación');
    return new Certificate(null, {
      studentId: input.studentId,
      type,
      status: 'approved',
      paymentId: input.paymentId ?? null,
      generatedAt: null,
      pdfPath: null,
      notes: optionalText(input.notes, 65_535, 'notas'),
      createdBy: input.createdBy,
      createdAt: input.issuedAt,
      verificationCode: input.verificationCode,
      snapshot: { ...input.snapshot },
    });
  }

  static request(input: RequestCertificateProps): Certificate {
    const type = input.type ?? 'certificado_estudiantil';
    Guard.oneOf(type, CERTIFICATE_TYPES, 'tipo de certificado');
    return new Certificate(null, {
      studentId: input.studentId,
      type,
      status: 'pending',
      paymentId: null,
      generatedAt: null,
      pdfPath: null,
      notes: optionalText(input.notes, 65_535, 'notas'),
      createdBy: input.requestedBy,
      createdAt: input.requestedAt,
      verificationCode: null,
      snapshot: null,
    });
  }

  static restore(id: number, props: CertificateProps): Certificate {
    return new Certificate(id, { ...props });
  }

  get studentId(): number {
    return this.props.studentId;
  }
  get type(): CertificateType {
    return this.props.type;
  }
  get status(): CertificateStatus {
    return this.props.status;
  }
  get paymentId(): number | null {
    return this.props.paymentId;
  }
  get generatedAt(): Date | null {
    return this.props.generatedAt;
  }
  get pdfPath(): string | null {
    return this.props.pdfPath;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
  get verificationCode(): string | null {
    return this.props.verificationCode;
  }
  get snapshot(): CertificateSnapshot | null {
    return this.props.snapshot;
  }

  /** Approved or already generated: can be printed and verified. */
  get isValid(): boolean {
    return this.props.status === 'approved' || this.props.status === 'generated';
  }

  /** Approves a pending request freezing the student data. */
  approve(verificationCode: string, snapshot: CertificateSnapshot): void {
    if (this.props.status !== 'pending') {
      throw new BusinessRuleViolationError(
        'Solo se pueden aprobar certificados pendientes.',
        'CERTIFICATE_NOT_PENDING',
      );
    }
    Guard.againstEmpty(verificationCode, 'código de verificación');
    this.props.status = 'approved';
    this.props.verificationCode = verificationCode;
    this.props.snapshot = { ...snapshot };
  }

  /** Cancels a request or an issued certificate; the reason is kept in the notes. */
  cancel(reason: string): void {
    if (this.props.status === 'cancelled') {
      throw new BusinessRuleViolationError('El certificado ya está anulado.', 'CERTIFICATE_ALREADY_CANCELLED');
    }
    Guard.againstEmpty(reason?.trim(), 'motivo de anulación');
    const note = `Anulado: ${reason.trim()}`;
    this.props.notes = optionalText(this.props.notes ? `${this.props.notes}\n${note}` : note, 65_535, 'notas');
    this.props.status = 'cancelled';
  }
}
