import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { monthInterval, schoolMonthOf } from '../../common/domain/school-calendar.js';
import {
  STUDENT_DIRECTORY,
  type StudentDirectoryPort,
  type StudentGender,
  studentDisplayName,
} from '../../common/domain/student-directory.port.js';
import {
  ATTENDANCE_RECORD_REPOSITORY,
  type AttendanceRecordRepository,
} from '../../attendance/domain/attendance-record.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { ClassroomOverviewService } from '../../structure/application/classroom-overview.service.js';
import type { ClassroomView } from '../../structure/application/structure-views.js';
import { CLASSROOM_REPOSITORY, type ClassroomRepository } from '../../structure/domain/structure.repositories.js';

/** More absences than this in the month flag the group as critical (rule 31). */
export const CRITICAL_MONTHLY_ABSENCES = 5;

export interface DirectorStudentRow {
  studentId: number;
  code: string;
  fullName: string;
  gender: StudentGender;
  documentType: string | null;
  documentNumber: string | null;
  phone: string | null;
}

export interface DirectorDashboardView {
  classroom: ClassroomView;
  month: string;
  totals: { students: number; boys: number; girls: number; monthlyAbsences: number; critical: boolean };
  students: DirectorStudentRow[];
}

/**
 * Group director panel (legacy `employee/group_director.php`): roster with
 * contact data and KPIs. Only the director of the classroom or an admin may
 * read it (the legacy listed any requested classroom: S5).
 */
@Injectable()
export class GetDirectorDashboardUseCase implements UseCase<
  { actor: AuthenticatedActor; classroomId: number },
  DirectorDashboardView
> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(ATTENDANCE_RECORD_REPOSITORY) private readonly attendance: AttendanceRecordRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute({
    actor,
    classroomId,
  }: {
    actor: AuthenticatedActor;
    classroomId: number;
  }): Promise<DirectorDashboardView> {
    await this.access.assertDirectorOf(actor, classroomId);
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    const month = schoolMonthOf(this.clock.now());
    const [[view], roster, monthlyAbsences] = await Promise.all([
      this.overview.describe([classroom]),
      this.students.listActiveByClassroom(classroomId),
      this.attendance.countByClassroomAndStatus(classroomId, monthInterval(month), 'absent'),
    ]);

    return {
      classroom: view,
      month,
      totals: {
        students: roster.length,
        boys: roster.filter((s) => s.gender === 'M').length,
        girls: roster.filter((s) => s.gender === 'F').length,
        monthlyAbsences,
        critical: monthlyAbsences > CRITICAL_MONTHLY_ABSENCES,
      },
      students: roster.map((student) => ({
        studentId: student.id,
        code: student.code,
        fullName: studentDisplayName(student).toUpperCase(),
        gender: student.gender,
        documentType: student.documentType,
        documentNumber: student.documentNumber,
        phone: student.phone,
      })),
    };
  }
}
