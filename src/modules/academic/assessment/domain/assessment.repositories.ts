import type { ReportCard } from './report-card.js';
import type { StudentGrade } from './student-grade.js';

/** Output port for {@link StudentGrade} (`student_grades`, keyed by `period_id`). */
export interface StudentGradeRepository {
  listBySubjectAndPeriod(subjectId: number, periodId: number): Promise<StudentGrade[]>;
  listByStudentAndYear(studentId: number, academicYear: number): Promise<StudentGrade[]>;
  listByStudentAndPeriod(studentId: number, periodId: number): Promise<StudentGrade[]>;
  listByPeriod(periodId: number): Promise<StudentGrade[]>;
  /** Inserts new grades and updates existing ones. */
  saveAll(grades: readonly StudentGrade[]): Promise<void>;
}

/** Output port for {@link ReportCard} (`student_bulletins`). */
export interface ReportCardRepository {
  findOne(studentId: number, periodId: number): Promise<ReportCard | null>;
  listByStudent(studentId: number): Promise<ReportCard[]>;
  listByPeriod(periodId: number): Promise<ReportCard[]>;
  save(card: ReportCard): Promise<void>;
  saveAll(cards: readonly ReportCard[]): Promise<void>;
}

export const STUDENT_GRADE_REPOSITORY = Symbol('StudentGradeRepository');
export const REPORT_CARD_REPOSITORY = Symbol('ReportCardRepository');
