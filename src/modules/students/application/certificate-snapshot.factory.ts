import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { CertificateSnapshot } from '../domain/certificate.js';
import { CLASSROOM_DIRECTORY, type ClassroomDirectoryPort } from '../domain/classroom-directory.port.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import type { Student } from '../domain/student.js';
import { academicYearOf } from './school-calendar.js';

/** Freezes the student data printed on a certificate at the moment it is issued. */
@Injectable()
export class CertificateSnapshotFactory {
  constructor(
    @Inject(CLASSROOM_DIRECTORY)
    private readonly classrooms: ClassroomDirectoryPort,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async snapshotOf(student: Student): Promise<CertificateSnapshot> {
    const [classroom, institution] = await Promise.all([
      student.classroomId !== null ? this.classrooms.findById(student.classroomId) : null,
      this.settings.load(),
    ]);
    return {
      studentName: student.fullName,
      studentCode: student.code.toString(),
      documentType: student.documentType,
      documentNumber: student.documentNumber,
      gradeName: classroom?.gradeName ?? null,
      classroomName: classroom?.name ?? null,
      academicYear: classroom?.academicYear ?? academicYearOf(institution, this.clock),
      studentStatus: student.status,
      enrollmentDate: student.enrollmentDate,
    };
  }
}
