import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { assertIsoDate } from '../../common/domain/school-calendar.js';

export interface GroupDirectorshipProps {
  classroomId: number;
  employeeId: number;
  /** Day the directorship started (`assignment_date`). */
  assignedOn: string;
  isActive: boolean;
}

/**
 * An employee responsible for a classroom (`group_directors`). History is kept
 * as inactive rows; at most one row per classroom is active (enforced by the
 * use case and by the `active_classroom_id` unique index — fixes B5).
 */
export class GroupDirectorship extends Entity<GroupDirectorshipProps> {
  private constructor(id: EntityId, props: GroupDirectorshipProps) {
    super(id, props);
  }

  static start(classroomId: number, employeeId: number, today: string): GroupDirectorship {
    return new GroupDirectorship(null, {
      classroomId,
      employeeId,
      assignedOn: assertIsoDate(today, 'fecha de asignación'),
      isActive: true,
    });
  }

  static restore(id: number, props: GroupDirectorshipProps): GroupDirectorship {
    return new GroupDirectorship(id, { ...props });
  }

  get classroomId(): number {
    return this.props.classroomId;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get assignedOn(): string {
    return this.props.assignedOn;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }

  end(): void {
    this.props.isActive = false;
  }
}
