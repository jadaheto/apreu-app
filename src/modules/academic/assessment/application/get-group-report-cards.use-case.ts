import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { indexBy } from '../../common/domain/collections.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  STUDENT_DIRECTORY,
  type StudentDirectoryPort,
  studentDisplayName,
} from '../../common/domain/student-directory.port.js';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from '../../calendar/domain/academic-period.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { CLASSROOM_REPOSITORY, type ClassroomRepository } from '../../structure/domain/structure.repositories.js';
import { REPORT_CARD_REPOSITORY, type ReportCardRepository } from '../domain/assessment.repositories.js';
import { isPassingAverage } from '../domain/score.js';

export interface GroupReportCardsInput {
  actor: AuthenticatedActor;
  classroomId: number;
  periodId: number;
}

export interface GroupReportCardRow {
  studentId: number;
  code: string;
  fullName: string;
  averageScore: number | null;
  passing: boolean | null;
  viewCount: number;
  status: 'generated' | 'pending';
}

export interface GroupReportCardsView {
  classroom: { id: number; name: string };
  period: { id: number; name: string };
  totals: {
    students: number;
    generated: number;
    /** Mean of the generated averages, one decimal. */
    groupAverage: number | null;
    topStudent: { studentId: number; fullName: string; averageScore: number } | null;
  };
  rows: GroupReportCardRow[];
}

/**
 * Report card status of a group for a period (legacy
 * `academic/group_bulletins.php`). Only the group director or an admin may
 * read it: the legacy did not validate the classroom (S5).
 */
@Injectable()
export class GetGroupReportCardsUseCase implements UseCase<GroupReportCardsInput, GroupReportCardsView> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(REPORT_CARD_REPOSITORY) private readonly reportCards: ReportCardRepository,
  ) {}

  async execute({ actor, classroomId, periodId }: GroupReportCardsInput): Promise<GroupReportCardsView> {
    await this.access.assertDirectorOf(actor, classroomId);
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    const [students, cards] = await Promise.all([
      this.students.listActiveByClassroom(classroomId),
      this.reportCards.listByPeriod(periodId),
    ]);
    const cardByStudent = indexBy(cards, (c) => c.studentId);

    const rows = students.map((student): GroupReportCardRow => {
      const card = cardByStudent.get(student.id);
      return {
        studentId: student.id,
        code: student.code,
        fullName: studentDisplayName(student).toUpperCase(),
        averageScore: card?.averageScore ?? null,
        passing: card ? isPassingAverage(card.averageScore) : null,
        viewCount: card?.viewCount ?? 0,
        status: card ? 'generated' : 'pending',
      };
    });
    const generated = rows.filter((row) => row.averageScore !== null);
    // Ties keep roster order (last name), like the legacy page.
    const top = generated.reduce<GroupReportCardRow | null>(
      (best, row) => (best === null || (row.averageScore as number) > (best.averageScore as number) ? row : best),
      null,
    );
    const groupAverage =
      generated.length === 0
        ? null
        : Math.round((generated.reduce((sum, row) => sum + (row.averageScore as number), 0) / generated.length) * 10) /
          10;

    return {
      classroom: { id: classroomId, name: classroom.name },
      period: { id: periodId, name: period.name },
      totals: {
        students: rows.length,
        generated: generated.length,
        groupAverage,
        topStudent: top
          ? { studentId: top.studentId, fullName: top.fullName, averageScore: top.averageScore as number }
          : null,
      },
      rows,
    };
  }
}
