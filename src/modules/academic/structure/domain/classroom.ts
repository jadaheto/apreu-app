import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { assertAcademicYear } from '../../common/domain/academic-year.js';
import { assertIntegerInRange } from '../../common/domain/integer-range.js';

export const DEFAULT_CLASSROOM_CAPACITY = 30;

export interface ClassroomProps {
  gradeId: number;
  name: string;
  capacity: number;
  academicYear: number;
}

export interface ClassroomData {
  gradeId: number;
  name: string;
  capacity?: number;
  academicYear: number;
}

/**
 * A group ("5A") of a grade in an academic year (`classrooms`).
 * Legacy: `academic/index.php` (create/edit_classroom). Capacity (1–100) is
 * informative only: it never blocks enrollment.
 */
export class Classroom extends Entity<ClassroomProps> {
  private constructor(id: EntityId, props: ClassroomProps) {
    super(id, props);
  }

  static create(data: ClassroomData): Classroom {
    return new Classroom(null, Classroom.validate(data));
  }

  static restore(id: number, props: ClassroomProps): Classroom {
    return new Classroom(id, { ...props });
  }

  get gradeId(): number {
    return this.props.gradeId;
  }
  get name(): string {
    return this.props.name;
  }
  get capacity(): number {
    return this.props.capacity;
  }
  get academicYear(): number {
    return this.props.academicYear;
  }

  /** The legacy UI paints the student count red when the group is full. */
  isFullWith(studentCount: number): boolean {
    return studentCount >= this.props.capacity;
  }

  /** Unlike the legacy edit form, the academic year can be corrected too (B26). */
  update(data: ClassroomData): void {
    Object.assign(this.props, Classroom.validate(data));
  }

  private static validate(data: ClassroomData): ClassroomProps {
    const name = data.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 50, 'nombre');
    Guard.againstEmpty(data.gradeId, 'grado');
    const capacity = assertIntegerInRange(data.capacity ?? DEFAULT_CLASSROOM_CAPACITY, 1, 100, 'capacidad');
    return { gradeId: data.gradeId, name, capacity, academicYear: assertAcademicYear(data.academicYear) };
  }
}
