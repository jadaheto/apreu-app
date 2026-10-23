import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { StudentDocumentType, StudentStatus } from './catalogs.js';
import type { Student } from './student.js';

/** Filters of the student directory (legacy `students/index.php`). */
export interface StudentSearchCriteria {
  /** Matches full name, code or document number. */
  search?: string;
  status?: StudentStatus;
  gradeId?: number;
  classroomId?: number;
  /** Students whose classroom belongs to this academic year, or without classroom. */
  academicYear?: number;
}

/** Output port for persisting {@link Student} aggregates. */
export interface StudentRepository {
  findById(id: number): Promise<Student | null>;
  findByIds(ids: number[]): Promise<Student[]>;
  findByDocument(documentType: StudentDocumentType, documentNumber: string): Promise<Student | null>;
  findByUserId(userId: number): Promise<Student | null>;
  /** Siblings sharing a guardian, ordered by name. */
  findByGuardianId(guardianId: number): Promise<Student[]>;
  existsByCode(code: string): Promise<boolean>;
  search(criteria: StudentSearchCriteria, page: PageRequest): Promise<Paginated<Student>>;
  /** Inserts or updates; assigns the id to new students. */
  save(student: Student): Promise<void>;
}

export const STUDENT_REPOSITORY = Symbol('StudentRepository');
