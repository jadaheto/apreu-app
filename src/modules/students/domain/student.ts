import { BusinessRuleViolationError, ConflictError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import {
  assertCalendarDate,
  BLOOD_TYPES,
  type BloodType,
  GENDERS,
  type Gender,
  initialsOf,
  optionalEmail,
  optionalText,
  requiredText,
  STUDENT_DOCUMENT_TYPES,
  STUDENT_STATUSES,
  type StudentDocumentType,
  type StudentStatus,
} from './catalogs.js';
import type { StudentCode } from './student-code.js';

/** Personal data editable by the school office (enrollment form, tab 1). */
export interface StudentDetails {
  firstName: string;
  lastName: string;
  documentType?: StudentDocumentType;
  documentNumber: string;
  birthDate?: string | null;
  gender?: Gender;
  bloodType?: BloodType | null;
  address?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  phone?: string | null;
  email?: string | null;
  eps?: string | null;
  scholarshipPct?: number;
  /** Observations (allergies, medical conditions…). Legacy never persisted them (bug B13). */
  notes?: string | null;
}

export interface StudentProps {
  userId: number | null;
  code: StudentCode;
  firstName: string;
  lastName: string;
  documentType: StudentDocumentType;
  documentNumber: string | null;
  birthDate: string | null;
  gender: Gender;
  bloodType: BloodType | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  phone: string | null;
  email: string | null;
  status: StudentStatus;
  guardianId: number | null;
  classroomId: number | null;
  academicYear: number | null;
  scholarshipPct: number;
  notes: string | null;
  photo: string | null;
  eps: string | null;
  enrollmentDate: string | null;
  createdAt: Date | null;
}

export interface EnrollStudentProps {
  code: StudentCode;
  details: StudentDetails;
  classroomId: number | null;
  academicYear: number;
  enrollmentDate: string;
  guardianId: number | null;
  /** Today (`YYYY-MM-DD`), used to reject birth dates in the future. */
  today: string;
}

/**
 * A student enrolled in the school (`students` table).
 *
 * Rules (analysis 03 §3.1, legacy `students/create.php`):
 * - first name, last name and document number are mandatory;
 * - defaults: document `TI`, gender `M`, status `active`, scholarship 0;
 * - blood type, gender, document type and status belong to closed catalogs;
 * - scholarship percentage within [0, 100];
 * - birth date must be a valid day before today;
 * - the institutional code never changes after enrollment.
 */
export class Student extends Entity<StudentProps> {
  private constructor(id: EntityId, props: StudentProps) {
    super(id, props);
  }

  static enroll(input: EnrollStudentProps): Student {
    assertCalendarDate(input.enrollmentDate, 'fecha de matrícula');
    const student = new Student(null, {
      ...Student.validateDetails(input.details, input.today),
      userId: null,
      code: input.code,
      status: 'active',
      guardianId: input.guardianId,
      classroomId: input.classroomId,
      academicYear: input.academicYear,
      photo: null,
      enrollmentDate: input.enrollmentDate,
      createdAt: null,
    });
    return student;
  }

  /** Rebuilds a persisted student without re-running creation rules. */
  static restore(id: number, props: StudentProps): Student {
    return new Student(id, { ...props });
  }

  get userId(): number | null {
    return this.props.userId;
  }
  get code(): StudentCode {
    return this.props.code;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
  get initials(): string {
    return initialsOf(this.props.firstName, this.props.lastName);
  }
  get documentType(): StudentDocumentType {
    return this.props.documentType;
  }
  get documentNumber(): string | null {
    return this.props.documentNumber;
  }
  get birthDate(): string | null {
    return this.props.birthDate;
  }
  get gender(): Gender {
    return this.props.gender;
  }
  get bloodType(): BloodType | null {
    return this.props.bloodType;
  }
  get address(): string | null {
    return this.props.address;
  }
  get city(): string | null {
    return this.props.city;
  }
  get neighborhood(): string | null {
    return this.props.neighborhood;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get email(): string | null {
    return this.props.email;
  }
  get status(): StudentStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return this.props.status === 'active';
  }
  get guardianId(): number | null {
    return this.props.guardianId;
  }
  get classroomId(): number | null {
    return this.props.classroomId;
  }
  get academicYear(): number | null {
    return this.props.academicYear;
  }
  get scholarshipPct(): number {
    return this.props.scholarshipPct;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get photo(): string | null {
    return this.props.photo;
  }
  get eps(): string | null {
    return this.props.eps;
  }
  get enrollmentDate(): string | null {
    return this.props.enrollmentDate;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Replaces the personal data (the code, status and links are not affected). */
  updateDetails(details: StudentDetails, today: string): void {
    Object.assign(this.props, Student.validateDetails(details, today));
  }

  /** Places the student in a classroom of the given academic year, or removes the assignment. */
  assignClassroom(classroomId: number | null, academicYear: number | null): void {
    this.props.classroomId = classroomId;
    if (academicYear !== null) this.props.academicYear = academicYear;
  }

  /** Explicit status transition (withdrawal, graduation, suspension…). Returns the previous status. */
  changeStatus(status: StudentStatus): StudentStatus {
    Guard.oneOf(status, STUDENT_STATUSES, 'estado');
    if (status === this.props.status) {
      throw new BusinessRuleViolationError(`El estudiante ya se encuentra en estado "${status}".`, 'SAME_STATUS');
    }
    const previous = this.props.status;
    this.props.status = status;
    return previous;
  }

  linkGuardian(guardianId: number): void {
    this.props.guardianId = guardianId;
  }

  unlinkGuardian(): void {
    this.props.guardianId = null;
  }

  /**
   * Links the portal user account. Fixes bug B12: legacy never filled
   * `students.user_id`, so the portal could not find the student.
   */
  linkUser(userId: number): void {
    if (this.props.userId !== null && this.props.userId !== userId) {
      throw new ConflictError('El estudiante ya tiene una cuenta de usuario vinculada.', { userId: this.props.userId });
    }
    this.props.userId = userId;
  }

  changePhoto(path: string | null): void {
    Guard.againstMaxLength(path, 255, 'foto');
    this.props.photo = path;
  }

  private static validateDetails(details: StudentDetails, today: string) {
    const documentType = details.documentType ?? 'TI';
    const gender = details.gender ?? 'M';
    const scholarshipPct = details.scholarshipPct ?? 0;
    Guard.oneOf(documentType, STUDENT_DOCUMENT_TYPES, 'tipo de documento');
    Guard.oneOf(gender, GENDERS, 'género');
    if (details.bloodType) Guard.oneOf(details.bloodType, BLOOD_TYPES, 'grupo sanguíneo');
    if (!Number.isFinite(scholarshipPct)) {
      throw new BusinessRuleViolationError('El porcentaje de beca debe ser numérico.', 'OUT_OF_RANGE');
    }
    Guard.inRange(scholarshipPct, 0, 100, 'beca');

    const birthDate = details.birthDate?.trim() || null;
    if (birthDate) {
      assertCalendarDate(birthDate, 'fecha de nacimiento');
      if (birthDate >= today) {
        throw new BusinessRuleViolationError('La fecha de nacimiento debe ser anterior a hoy.', 'INVALID_BIRTH_DATE');
      }
    }

    return {
      firstName: requiredText(details.firstName, 100, 'nombres'),
      lastName: requiredText(details.lastName, 100, 'apellidos'),
      documentType,
      documentNumber: requiredText(details.documentNumber, 30, 'número de documento'),
      birthDate,
      gender,
      bloodType: details.bloodType ?? null,
      address: optionalText(details.address, 65_535, 'dirección'),
      city: optionalText(details.city, 100, 'ciudad'),
      neighborhood: optionalText(details.neighborhood, 100, 'barrio'),
      phone: optionalText(details.phone, 20, 'teléfono'),
      email: optionalEmail(details.email),
      eps: optionalText(details.eps, 100, 'EPS'),
      scholarshipPct: Math.round(scholarshipPct * 100) / 100,
      notes: optionalText(details.notes, 65_535, 'observaciones'),
    };
  }
}
