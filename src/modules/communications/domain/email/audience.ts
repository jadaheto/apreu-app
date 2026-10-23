import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { ValueObject } from '../../../../shared/domain/value-object.js';

export const AUDIENCE_KINDS = ['all_parents', 'by_grade', 'by_classroom', 'all_employees', 'manual'] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

/** Maximum addresses accepted in a manual list. */
export const MAX_MANUAL_EMAILS = 500;

export interface AudienceProps {
  kind: AudienceKind;
  gradeId: number | null;
  classroomId: number | null;
  manualEmails: string[];
}

export interface AudienceInput {
  kind: AudienceKind;
  gradeId?: number | null;
  classroomId?: number | null;
  /** Comma/semicolon/newline separated list or array (manual audience). */
  manualEmails?: string | string[] | null;
}

/**
 * Who receives a notice e-mail (RN-COM-04, legacy `email/compose.php`):
 * all guardians, guardians of a grade, guardians of a classroom, every
 * active employee, or a manual list of addresses.
 */
export class Audience extends ValueObject<AudienceProps> {
  private constructor(props: AudienceProps) {
    super(props);
  }

  static create(input: AudienceInput): Audience {
    Guard.oneOf(input.kind, AUDIENCE_KINDS, 'destinatarios');
    const gradeId = input.kind === 'by_grade' ? Audience.requiredId(input.gradeId, 'grado') : null;
    const classroomId = input.kind === 'by_classroom' ? Audience.requiredId(input.classroomId, 'salón') : null;
    const manualEmails = input.kind === 'manual' ? Audience.splitManual(input.manualEmails) : [];
    if (input.kind === 'manual' && manualEmails.length === 0) {
      throw new BusinessRuleViolationError('Ingrese al menos un correo en la lista manual.', 'EMPTY_MANUAL_LIST');
    }
    if (manualEmails.length > MAX_MANUAL_EMAILS) {
      throw new BusinessRuleViolationError(
        `La lista manual admite máximo ${MAX_MANUAL_EMAILS} correos.`,
        'MANUAL_LIST_TOO_LONG',
      );
    }
    return new Audience({ kind: input.kind, gradeId, classroomId, manualEmails });
  }

  get kind(): AudienceKind {
    return this.value.kind;
  }
  get gradeId(): number | null {
    return this.value.gradeId;
  }
  get classroomId(): number | null {
    return this.value.classroomId;
  }
  get manualEmails(): readonly string[] {
    return this.value.manualEmails;
  }

  private static requiredId(id: number | null | undefined, field: string): number {
    if (!id || !Number.isInteger(id) || id <= 0) {
      throw new BusinessRuleViolationError(`Seleccione un ${field}.`, 'AUDIENCE_TARGET_REQUIRED', { field });
    }
    return id;
  }

  private static splitManual(raw: string | string[] | null | undefined): string[] {
    const parts = Array.isArray(raw) ? raw : (raw ?? '').split(/[,;\n]/);
    return parts.map((part) => part.trim()).filter(Boolean);
  }
}
