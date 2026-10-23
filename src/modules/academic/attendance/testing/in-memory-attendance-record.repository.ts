import { ConflictError } from '../../../../shared/domain/domain-error.js';
import { toOffset, type PageRequest } from '../../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../../shared/testing/fakes.js';
import type { DateInterval } from '../../common/domain/school-calendar.js';
import type { AttendanceRecord, AttendanceStatus } from '../domain/attendance-record.js';
import type { AttendanceRecordRepository, DailyAttendanceCriteria } from '../domain/attendance-record.repository.js';

export class InMemoryAttendanceRecordRepository implements AttendanceRecordRepository {
  readonly store = new InMemoryStore<AttendanceRecord>();

  async listForClass(subjectId: number, classroomId: number, date: string) {
    return this.store
      .all()
      .filter((r) => r.subjectId === subjectId && r.classroomId === classroomId && r.date === date);
  }
  async searchByDate(criteria: DailyAttendanceCriteria, page: PageRequest) {
    const matches = this.ofDay(criteria).sort((a, b) => b.time.localeCompare(a.time));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }
  async countByStatusOnDate(criteria: DailyAttendanceCriteria) {
    const counts = new Map<AttendanceStatus, number>();
    this.ofDay(criteria).forEach((r) => counts.set(r.status, (counts.get(r.status) ?? 0) + 1));
    return counts;
  }
  async listRecentByStudent(studentId: number, limit: number) {
    return this.store
      .all()
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, limit);
  }
  async listByStudentBetween(studentId: number, { from, to }: DateInterval) {
    return this.store.all().filter((r) => r.studentId === studentId && r.date >= from && r.date <= to);
  }
  async countByClassroomAndStatus(classroomId: number, { from, to }: DateInterval, status: AttendanceStatus) {
    return this.store
      .all()
      .filter((r) => r.classroomId === classroomId && r.status === status && r.date >= from && r.date <= to).length;
  }
  async save(record: AttendanceRecord) {
    const duplicate = this.store
      .all()
      .find(
        (r) =>
          r !== record &&
          r.studentId === record.studentId &&
          r.subjectId === record.subjectId &&
          r.classroomId === record.classroomId &&
          r.date === record.date,
      );
    if (duplicate) throw new ConflictError('Asistencia ya registrada hoy para esta clase.');
    this.store.save(record);
  }

  private ofDay({ date, classroomId }: DailyAttendanceCriteria) {
    return this.store
      .all()
      .filter((r) => r.date === date && (classroomId === undefined || r.classroomId === classroomId));
  }
}
