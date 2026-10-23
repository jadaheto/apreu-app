import { toIsoDate } from '../../../common/infrastructure/orm-support.js';
import { AttendanceRecord } from '../../domain/attendance-record.js';
import { AttendanceRecordOrmEntity } from './attendance-record.orm-entity.js';

/** Row ↔ aggregate translation for `attendance_records`. */
export const AttendanceRecordMapper = {
  toDomain: (row: AttendanceRecordOrmEntity): AttendanceRecord =>
    AttendanceRecord.restore(row.id, {
      studentId: row.studentId,
      employeeId: row.employeeId,
      subjectId: row.subjectId,
      classroomId: row.classroomId,
      date: toIsoDate(row.attendanceDate),
      time: row.attendanceTime.slice(0, 8),
      status: row.status ?? 'present',
      source: row.source ?? 'qr',
    }),

  toPersistence: (record: AttendanceRecord): AttendanceRecordOrmEntity => {
    const row = new AttendanceRecordOrmEntity();
    if (record.id !== null) row.id = record.id;
    row.studentId = record.studentId;
    row.employeeId = record.employeeId;
    row.subjectId = record.subjectId;
    row.classroomId = record.classroomId;
    row.attendanceDate = record.date;
    row.attendanceTime = record.time;
    row.status = record.status;
    row.source = record.source;
    return row;
  },
};
