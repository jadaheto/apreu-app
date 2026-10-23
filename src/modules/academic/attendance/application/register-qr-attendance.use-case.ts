import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError, ConflictError } from '../../../../shared/domain/domain-error.js';
import { requireFound } from '../../common/domain/require-found.js';
import { schoolDateOf, schoolTimeOf } from '../../common/domain/school-calendar.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../../common/domain/student-directory.port.js';
import { AttendanceRecord } from '../domain/attendance-record.js';
import {
  ATTENDANCE_RECORD_REPOSITORY,
  type AttendanceRecordRepository,
} from '../domain/attendance-record.repository.js';
import { StudentQrPayload } from '../domain/student-qr-payload.js';
import { ClassSessionService } from './class-session.service.js';
import { STUDENT_QR_VERIFIER, type StudentQrVerifierPort } from './ports/student-qr-verifier.port.js';

export interface RegisterQrAttendanceInput {
  actor: AuthenticatedActor;
  rawQr: string;
  subjectId: number;
  classroomId: number;
}

export interface QrAttendanceRegistered {
  recordId: number;
  student: { id: number; firstName: string; lastName: string; documentNumber: string | null };
  date: string;
  time: string;
}

/**
 * Registers a student as present by scanning the ID card QR (legacy
 * `api/register_attendance.php`, which had no authentication and trusted a
 * client-sent `teacher_id`: S1). New rules: authenticated teacher taken from
 * the token, subject assigned to them in the classroom, signed card (HMAC,
 * S13/B29) issued by this school for the classroom's academic year, student
 * active in that classroom and one record per class per day.
 */
@Injectable()
export class RegisterQrAttendanceUseCase implements UseCase<RegisterQrAttendanceInput, QrAttendanceRegistered> {
  constructor(
    private readonly sessions: ClassSessionService,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(ATTENDANCE_RECORD_REPOSITORY) private readonly attendance: AttendanceRecordRepository,
    @Inject(STUDENT_QR_VERIFIER) private readonly verifier: StudentQrVerifierPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, rawQr, subjectId, classroomId }: RegisterQrAttendanceInput): Promise<QrAttendanceRegistered> {
    const payload = StudentQrPayload.parse(rawQr);
    if (payload.tenant !== actor.tenant || !this.verifier.isAuthentic(payload.signedContent, payload.signature)) {
      throw new BusinessRuleViolationError(
        'El carnet no es auténtico o no pertenece a este colegio.',
        'QR_NOT_AUTHENTIC',
      );
    }
    const { classroom, employee } = await this.sessions.open(actor, classroomId, subjectId);
    if (payload.academicYear !== classroom.academicYear) {
      throw new BusinessRuleViolationError(
        `El carnet corresponde al año ${payload.academicYear} y el salón al año lectivo ${classroom.academicYear}.`,
        'QR_WRONG_YEAR',
      );
    }
    const student = requireFound(await this.students.findById(payload.studentId), 'Estudiante', payload.studentId);
    if (!student.isActive || student.classroomId !== classroomId) {
      throw new BusinessRuleViolationError(
        'El carnet no corresponde a un estudiante activo de este salón.',
        'QR_STUDENT_NOT_IN_CLASSROOM',
      );
    }

    const now = this.clock.now();
    const date = schoolDateOf(now);
    const alreadyRegistered = (await this.attendance.listForClass(subjectId, classroomId, date)).some(
      (record) => record.studentId === student.id,
    );
    if (alreadyRegistered) throw new ConflictError('Asistencia ya registrada hoy para esta clase.');

    const record = AttendanceRecord.register({
      studentId: student.id,
      employeeId: employee.id,
      subjectId,
      classroomId,
      date,
      time: schoolTimeOf(now),
      status: 'present',
      source: 'qr',
    });
    await this.attendance.save(record);
    return {
      recordId: record.id as number,
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        documentNumber: student.documentNumber,
      },
      date: record.date,
      time: record.time,
    };
  }
}
