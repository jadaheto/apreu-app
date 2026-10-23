import type { AttendanceSource, AttendanceStatus } from '../domain/attendance-record.js';

/** One attendance record with the names needed by the reports. */
export interface AttendanceRecordView {
  id: number;
  date: string;
  time: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  student: { id: number; fullName: string; code: string; documentNumber: string | null } | null;
  classroomName: string | null;
  subjectName: string | null;
  teacherName: string | null;
}

/** Counters per status. */
export type AttendanceTotals = Record<AttendanceStatus, number>;

export const emptyTotals = (): AttendanceTotals => ({ present: 0, absent: 0, late: 0, excused: 0 });
