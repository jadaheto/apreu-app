import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import type { Classroom } from './classroom.js';
import type { Subject } from './subject.js';

export interface TeachingAssignmentProps {
  employeeId: number;
  subjectId: number;
  classroomId: number;
  academicYear: number;
}

/**
 * Which teacher teaches which subject in which classroom and year
 * (`teacher_assignments`). Legacy: `academic/assignments.php`.
 *
 * Invariants: the subject belongs to the classroom's grade (only the legacy UI
 * guaranteed it) and the year is the classroom's year. Uniqueness per
 * (subject, classroom, year) is checked by the use case and the database.
 */
export class TeachingAssignment extends Entity<TeachingAssignmentProps> {
  private constructor(id: EntityId, props: TeachingAssignmentProps) {
    super(id, props);
  }

  static create(input: { employeeId: number; subject: Subject; classroom: Classroom }): TeachingAssignment {
    const { subject, classroom } = input;
    if (subject.gradeId !== classroom.gradeId) {
      throw new BusinessRuleViolationError(
        `La materia "${subject.name}" no pertenece al grado del salón "${classroom.name}".`,
        'SUBJECT_NOT_IN_GRADE',
      );
    }
    return new TeachingAssignment(null, {
      employeeId: input.employeeId,
      subjectId: subject.id as number,
      classroomId: classroom.id as number,
      academicYear: classroom.academicYear,
    });
  }

  static restore(id: number, props: TeachingAssignmentProps): TeachingAssignment {
    return new TeachingAssignment(id, { ...props });
  }

  get employeeId(): number {
    return this.props.employeeId;
  }
  get subjectId(): number {
    return this.props.subjectId;
  }
  get classroomId(): number {
    return this.props.classroomId;
  }
  get academicYear(): number {
    return this.props.academicYear;
  }

  isTaughtBy(employeeId: number): boolean {
    return this.props.employeeId === employeeId;
  }

  /** Replaces the teacher (legacy edit was broken: B6). */
  changeTeacher(employeeId: number): void {
    this.props.employeeId = employeeId;
  }
}
