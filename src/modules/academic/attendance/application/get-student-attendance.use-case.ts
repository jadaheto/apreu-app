import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { monthInterval, schoolMonthOf } from '../../common/domain/school-calendar.js';
import { studentDisplayName } from '../../common/domain/student-directory.port.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import {
  ATTENDANCE_RECORD_REPOSITORY,
  type AttendanceRecordRepository,
} from '../domain/attendance-record.repository.js';
import { AttendanceViewAssembler } from './attendance-view.assembler.js';
import { emptyTotals, type AttendanceRecordView, type AttendanceTotals } from './attendance-views.js';

export const RECENT_ATTENDANCE_LIMIT = 50;

export interface GetStudentAttendanceInput {
  actor: AuthenticatedActor;
  studentId: number;
  /** `YYYY-MM`; defaults to the current month. */
  month?: string;
}

export interface StudentAttendanceView {
  student: { id: number; code: string; fullName: string };
  month: string;
  summary: AttendanceTotals & {
    /** Distinct days with a present/late record. */
    daysAttended: number;
    totalRecords: number;
  };
  /** Latest records (any month), newest first. */
  recent: AttendanceRecordView[];
}

/**
 * Attendance of a student (legacy `student/asistencia.php`): monthly KPIs by
 * real status (the legacy counted every record as present: B22) and the last
 * 50 records. Readable by admins, the student, guardians and the group director.
 */
@Injectable()
export class GetStudentAttendanceUseCase implements UseCase<GetStudentAttendanceInput, StudentAttendanceView> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(ATTENDANCE_RECORD_REPOSITORY) private readonly attendance: AttendanceRecordRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly assembler: AttendanceViewAssembler,
  ) {}

  async execute({ actor, studentId, month }: GetStudentAttendanceInput): Promise<StudentAttendanceView> {
    const student = await this.access.readableStudent(actor, studentId, 'attendance');
    const selectedMonth = month ?? schoolMonthOf(this.clock.now());
    const [ofMonth, recent] = await Promise.all([
      this.attendance.listByStudentBetween(studentId, monthInterval(selectedMonth)),
      this.attendance.listRecentByStudent(studentId, RECENT_ATTENDANCE_LIMIT),
    ]);

    const totals = emptyTotals();
    ofMonth.forEach((record) => (totals[record.status] += 1));
    return {
      student: { id: student.id, code: student.code, fullName: studentDisplayName(student) },
      month: selectedMonth,
      summary: {
        ...totals,
        daysAttended: new Set(ofMonth.filter((r) => r.attended).map((r) => r.date)).size,
        totalRecords: ofMonth.length,
      },
      recent: await this.assembler.toViews(recent),
    };
  }
}
