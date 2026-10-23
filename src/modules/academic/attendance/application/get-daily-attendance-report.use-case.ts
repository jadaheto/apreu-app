import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import { assertIsoDate, schoolDateOf } from '../../common/domain/school-calendar.js';
import {
  ATTENDANCE_RECORD_REPOSITORY,
  type AttendanceRecordRepository,
} from '../domain/attendance-record.repository.js';
import { AttendanceViewAssembler } from './attendance-view.assembler.js';
import { emptyTotals, type AttendanceRecordView, type AttendanceTotals } from './attendance-views.js';

export interface DailyAttendanceReportInput {
  /** Defaults to today (school time). */
  date?: string;
  classroomId?: number;
  page: PageRequest;
}

export interface DailyAttendanceReportView {
  date: string;
  totals: AttendanceTotals;
  records: Paginated<AttendanceRecordView>;
}

/**
 * Consolidated attendance of a day, optionally for one classroom (legacy
 * `academic/attendance.php`). Totals are per status — the legacy title counted
 * every row as "present".
 */
@Injectable()
export class GetDailyAttendanceReportUseCase implements UseCase<DailyAttendanceReportInput, DailyAttendanceReportView> {
  constructor(
    @Inject(ATTENDANCE_RECORD_REPOSITORY) private readonly attendance: AttendanceRecordRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly assembler: AttendanceViewAssembler,
  ) {}

  async execute({ page, classroomId, ...input }: DailyAttendanceReportInput): Promise<DailyAttendanceReportView> {
    const date = input.date === undefined ? schoolDateOf(this.clock.now()) : assertIsoDate(input.date, 'fecha');
    const criteria = { date, classroomId };
    const [records, counts] = await Promise.all([
      this.attendance.searchByDate(criteria, page),
      this.attendance.countByStatusOnDate(criteria),
    ]);
    return {
      date,
      totals: { ...emptyTotals(), ...Object.fromEntries(counts) },
      records: { ...records, items: await this.assembler.toViews(records.items) },
    };
  }
}
