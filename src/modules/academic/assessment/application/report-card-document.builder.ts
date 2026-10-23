import { Inject, Injectable } from '@nestjs/common';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import {
  STAFF_DIRECTORY,
  type StaffDirectoryPort,
  staffDisplayName,
} from '../../common/domain/staff-directory.port.js';
import { type StudentSummary, studentDisplayName } from '../../common/domain/student-directory.port.js';
import {
  ATTENDANCE_RECORD_REPOSITORY,
  type AttendanceRecordRepository,
} from '../../attendance/domain/attendance-record.repository.js';
import type { AcademicPeriod } from '../../calendar/domain/academic-period.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GRADE_REPOSITORY,
  type GradeRepository,
  GROUP_DIRECTORSHIP_REPOSITORY,
  type GroupDirectorshipRepository,
} from '../../structure/domain/structure.repositories.js';
import { STUDENT_GRADE_REPOSITORY, type StudentGradeRepository } from '../domain/assessment.repositories.js';
import { classifyAverage } from '../domain/performance-scale.js';
import type { ReportCard } from '../domain/report-card.js';
import { isPassingAverage } from '../domain/score.js';
import { GradeLinesService } from './grade-lines.service.js';
import type { ReportCardDocument } from './report-card-document.js';

/**
 * Assembles a {@link ReportCardDocument}. The average shown is the one stored
 * when the report card was generated, so the printed and listed averages never
 * diverge (legacy B20).
 */
@Injectable()
export class ReportCardDocumentBuilder {
  constructor(
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
    @Inject(STUDENT_GRADE_REPOSITORY) private readonly grades: StudentGradeRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(GRADE_REPOSITORY) private readonly gradeCatalog: GradeRepository,
    @Inject(GROUP_DIRECTORSHIP_REPOSITORY) private readonly directorships: GroupDirectorshipRepository,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
    @Inject(ATTENDANCE_RECORD_REPOSITORY) private readonly attendance: AttendanceRecordRepository,
    private readonly gradeLines: GradeLinesService,
  ) {}

  async build(student: StudentSummary, period: AcademicPeriod, card: ReportCard): Promise<ReportCardDocument> {
    const periodId = period.id as number;
    const [institution, grades, classroom, absences] = await Promise.all([
      this.settings.institutionProfile(),
      this.grades.listByStudentAndPeriod(student.id, periodId),
      student.classroomId === null ? null : this.classrooms.findById(student.classroomId),
      this.countAbsences(student.id, period),
    ]);
    const [lines, grade, directorName] = await Promise.all([
      this.gradeLines.linesFor(grades, student.classroomId, period.academicYear),
      classroom ? this.gradeCatalog.findById(classroom.gradeId) : null,
      classroom ? this.directorName(classroom.id as number) : null,
    ]);

    return {
      institution,
      student: {
        id: student.id,
        code: student.code,
        fullName: studentDisplayName(student).toUpperCase(),
        documentNumber: student.documentNumber,
      },
      classroom: classroom ? { name: classroom.name, gradeName: grade?.name ?? '' } : null,
      groupDirectorName: directorName,
      period: {
        id: periodId,
        name: period.name,
        academicYear: period.academicYear,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      lines,
      averageScore: card.averageScore,
      averagePerformance: classifyAverage(card.averageScore),
      passing: isPassingAverage(card.averageScore),
      absences,
      generatedAt: card.generatedAt,
      viewCount: card.viewCount,
    };
  }

  private async countAbsences(studentId: number, period: AcademicPeriod): Promise<number> {
    const records = await this.attendance.listByStudentBetween(studentId, {
      from: period.startDate,
      to: period.endDate,
    });
    return records.filter((record) => record.status === 'absent').length;
  }

  private async directorName(classroomId: number): Promise<string | null> {
    const directorship = await this.directorships.findActiveByClassroom(classroomId);
    const director = directorship ? await this.staff.findById(directorship.employeeId) : null;
    return director ? staffDisplayName(director) : null;
  }
}
