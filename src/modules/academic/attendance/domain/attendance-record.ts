import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { assertIsoDate } from '../../common/domain/school-calendar.js';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** How the record was captured: QR card scan or manual roll call. */
export type AttendanceSource = 'qr' | 'manual';

/** Statuses that count as the student being in class. */
export const ATTENDED_STATUSES: readonly AttendanceStatus[] = ['present', 'late'];

export interface AttendanceRecordProps {
  studentId: number;
  /** Teacher who took attendance — always the authenticated user, never client input (S1). */
  employeeId: number;
  /** `null` only for legacy rows whose subject/classroom was deleted (FK `SET NULL`). */
  subjectId: number | null;
  classroomId: number | null;
  date: string;
  /** `HH:mm:ss` school time. */
  time: string;
  status: AttendanceStatus;
  source: AttendanceSource;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

/**
 * Attendance of a student to a class on a day (`attendance_records`).
 * One record per (student, subject, classroom, date) — rule 29.
 * Legacy: `api/register_attendance.php` (QR only, always `present`).
 */
export class AttendanceRecord extends Entity<AttendanceRecordProps> {
  private constructor(id: EntityId, props: AttendanceRecordProps) {
    super(id, props);
  }

  static register(props: AttendanceRecordProps & { subjectId: number; classroomId: number }): AttendanceRecord {
    assertIsoDate(props.date, 'fecha de asistencia');
    Guard.oneOf(props.status, ATTENDANCE_STATUSES, 'estado');
    if (!TIME_PATTERN.test(props.time)) {
      throw new BusinessRuleViolationError('La hora de asistencia debe tener el formato HH:mm:ss.', 'INVALID_TIME');
    }
    return new AttendanceRecord(null, { ...props });
  }

  static restore(id: number, props: AttendanceRecordProps): AttendanceRecord {
    return new AttendanceRecord(id, { ...props });
  }

  get studentId(): number {
    return this.props.studentId;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get subjectId(): number | null {
    return this.props.subjectId;
  }
  get classroomId(): number | null {
    return this.props.classroomId;
  }
  get date(): string {
    return this.props.date;
  }
  get time(): string {
    return this.props.time;
  }
  get status(): AttendanceStatus {
    return this.props.status;
  }
  get source(): AttendanceSource {
    return this.props.source;
  }
  get attended(): boolean {
    return ATTENDED_STATUSES.includes(this.props.status);
  }

  /** Manual roll call corrects the status; the teacher who corrects is recorded. */
  changeStatus(status: AttendanceStatus, employeeId: number): void {
    Guard.oneOf(status, ATTENDANCE_STATUSES, 'estado');
    this.props.status = status;
    this.props.employeeId = employeeId;
    this.props.source = 'manual';
  }
}
