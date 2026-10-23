import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Email } from '../../../shared/domain/value-objects/email.vo.js';

/** Student identity documents (`students.document_type`). Legacy UI aliases: `pa → PP`, `ext → CE`. */
export const STUDENT_DOCUMENT_TYPES = ['TI', 'CC', 'CE', 'PP', 'RC'] as const;
export type StudentDocumentType = (typeof STUDENT_DOCUMENT_TYPES)[number];

/** Guardian identity documents (`guardians.document_type`). */
export const GUARDIAN_DOCUMENT_TYPES = ['cc', 'ti', 'ce', 'pa', 'rc'] as const;
export type GuardianDocumentType = (typeof GUARDIAN_DOCUMENT_TYPES)[number];

/** Guardian relationship with the student (`guardians.relationship`). */
export const RELATIONSHIPS = ['padre', 'madre', 'abuelo', 'abuela', 'tio', 'tia', 'otro'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const GENDERS = ['M', 'F', 'O'] as const;
export type Gender = (typeof GENDERS)[number];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

/** Lifecycle of a student (`students.status`). */
export const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'withdrawn', 'suspended'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a calendar day in `YYYY-MM-DD` format (rejects impossible dates
 * such as `2026-02-30`).
 */
export const assertCalendarDate = (value: string, field: string): void => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!DATE_PATTERN.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BusinessRuleViolationError(
      `El campo "${field}" debe ser una fecha válida (AAAA-MM-DD).`,
      'INVALID_DATE',
      {
        field,
      },
    );
  }
};

/** Trims an optional text; blank values become `null`. Enforces the column length. */
export const optionalText = (value: string | null | undefined, max: number, field: string): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return null;
  Guard.againstMaxLength(trimmed, max, field);
  return trimmed;
};

/** Trims a mandatory text and enforces the column length. */
export const requiredText = (value: string | null | undefined, max: number, field: string): string => {
  const trimmed = value?.trim() ?? '';
  Guard.againstEmpty(trimmed, field);
  Guard.againstMaxLength(trimmed, max, field);
  return trimmed;
};

/** Optional e-mail, normalized to lower case; blank values become `null`. */
export const optionalEmail = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : Email.create(trimmed).toString();
};

/** Upper-cased initials of a person (avatar fallback in the legacy UI). */
export const initialsOf = (firstName: string, lastName: string): string =>
  `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
