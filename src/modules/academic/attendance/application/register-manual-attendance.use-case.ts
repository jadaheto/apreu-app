import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { indexBy } from '../../common/domain/collections.js';
import { assertIsoDate, schoolDateOf, schoolTimeOf } from '../../common/domain/school-calendar.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../../common/domain/student-directory.port.js';
import { AttendanceRecord, type AttendanceStatus } from '../domain/attendance-record.js';
import {
  ATTENDANCE_RECORD_REPOSITORY,
  type AttendanceRecordRepository,
} from '../domain/attendance-record.repository.js';
import { ClassSessionService } from './class-session.service.js';

export interface ManualAttendanceEntry {
  studentId: number;
  status: AttendanceStatus;
}

export interface RegisterManualAttendanceInput {
  actor: AuthenticatedActor;
  classroomId: number;
  subjectId: number;
  /** Defaults to today; future dates are rejected. */
  date?: string;
  entries: ManualAttendanceEntry[];
}

/**
 * Manual roll call (new: the legacy could only record `present` by QR, so
 * absences were never registered — B22). Upserts one record per student for
 * the class and day, in a transaction; existing QR records are corrected.
 */
@Injectable()
export class RegisterManualAttendanceUseCase implements UseCase<RegisterManualAttendanceInput, { saved: number }> {
  constructor(
    private readonly sessions: ClassSessionService,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(ATTENDANCE_RECORD_REPOSITORY) private readonly attendance: AttendanceRecordRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({
    actor,
    classroomId,
    subjectId,
    entries,
    ...input
  }: RegisterManualAttendanceInput): Promise<{ saved: number }> {
    const { employee } = await this.sessions.open(actor, classroomId, subjectId);
    const now = this.clock.now();
    const today = schoolDateOf(now);
    const date = input.date === undefined ? today : assertIsoDate(input.date, 'fecha');
    if (date > today) {
      throw new BusinessRuleViolationError('No se puede registrar asistencia en una fecha futura.', 'FUTURE_DATE');
    }
    const ids = entries.map((entry) => entry.studentId);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleViolationError('Un estudiante aparece más de una vez en la lista.', 'DUPLICATED_STUDENT');
    }
    const roster = new Set((await this.students.listActiveByClassroom(classroomId)).map((s) => s.id));
    const outsiders = ids.filter((id) => !roster.has(id));
    if (outsiders.length > 0) {
      throw new BusinessRuleViolationError(
        'Algunos estudiantes no pertenecen a este salón o no están activos.',
        'STUDENT_NOT_IN_CLASSROOM',
        { studentIds: outsiders },
      );
    }

    return this.uow.runInTransaction(async () => {
      const existing = indexBy(await this.attendance.listForClass(subjectId, classroomId, date), (r) => r.studentId);
      for (const entry of entries) {
        const record = existing.get(entry.studentId);
        if (record) {
          record.changeStatus(entry.status, employee.id);
          await this.attendance.save(record);
          continue;
        }
        await this.attendance.save(
          AttendanceRecord.register({
            studentId: entry.studentId,
            employeeId: employee.id,
            subjectId,
            classroomId,
            date,
            time: schoolTimeOf(now),
            status: entry.status,
            source: 'manual',
          }),
        );
      }
      return { saved: entries.length };
    });
  }
}
