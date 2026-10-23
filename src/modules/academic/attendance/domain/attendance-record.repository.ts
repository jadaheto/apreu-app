import type { DateInterval } from '../../common/domain/school-calendar.js';
import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { AttendanceRecord, AttendanceStatus } from './attendance-record.js';

export interface DailyAttendanceCriteria {
  date: string;
  classroomId?: number;
}

/** Output port for {@link AttendanceRecord} (`attendance_records`). */
export interface AttendanceRecordRepository {
  /** Records of one class session (subject + classroom + date). */
  listForClass(subjectId: number, classroomId: number, date: string): Promise<AttendanceRecord[]>;
  /** Records of a day ordered by time (newest first). */
  searchByDate(criteria: DailyAttendanceCriteria, page: PageRequest): Promise<Paginated<AttendanceRecord>>;
  /** Number of records of a day per status. */
  countByStatusOnDate(criteria: DailyAttendanceCriteria): Promise<Map<AttendanceStatus, number>>;
  /** Most recent records of a student. */
  listRecentByStudent(studentId: number, limit: number): Promise<AttendanceRecord[]>;
  listByStudentBetween(studentId: number, interval: DateInterval): Promise<AttendanceRecord[]>;
  countByClassroomAndStatus(classroomId: number, interval: DateInterval, status: AttendanceStatus): Promise<number>;
  /**
   * Inserts or updates. Throws `ConflictError` when another record already
   * exists for the same student, subject, classroom and date.
   */
  save(record: AttendanceRecord): Promise<void>;
}

export const ATTENDANCE_RECORD_REPOSITORY = Symbol('AttendanceRecordRepository');
