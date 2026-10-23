import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
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
import type { DownloadableFile } from './downloadable-file.js';
import { safeFileName } from './file-names.js';
import type { GroupReportCardsInput } from './get-group-report-cards.use-case.js';
import { DOCUMENT_ARCHIVER, type DocumentArchiverPort } from './ports/document-archiver.port.js';
import { REPORT_CARD_RENDERER, type ReportCardRendererPort } from './ports/report-card-renderer.port.js';
import { ReportCardDocumentBuilder } from './report-card-document.builder.js';

/**
 * ZIP with the PDF report cards of a group for a period — the "Descargar ZIP"
 * button the legacy never implemented (B27). Director of the group or admin.
 */
@Injectable()
export class DownloadGroupReportCardsUseCase implements UseCase<GroupReportCardsInput, DownloadableFile> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(REPORT_CARD_REPOSITORY) private readonly reportCards: ReportCardRepository,
    private readonly builder: ReportCardDocumentBuilder,
    @Inject(REPORT_CARD_RENDERER) private readonly renderer: ReportCardRendererPort,
    @Inject(DOCUMENT_ARCHIVER) private readonly archiver: DocumentArchiverPort,
  ) {}

  async execute({ actor, classroomId, periodId }: GroupReportCardsInput): Promise<DownloadableFile> {
    await this.access.assertDirectorOf(actor, classroomId);
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    const cards = indexBy(await this.reportCards.listByPeriod(periodId), (c) => c.studentId);
    const students = (await this.students.listActiveByClassroom(classroomId)).filter((s) => cards.has(s.id));
    if (students.length === 0) {
      throw new BusinessRuleViolationError('El grupo no tiene boletines generados en este período.', 'NO_REPORT_CARDS');
    }

    const entries = [];
    for (const student of students) {
      const document = await this.builder.build(student, period, cards.get(student.id)!);
      entries.push({
        fileName: `${safeFileName(student.code)}-${safeFileName(studentDisplayName(student))}.pdf`,
        content: await this.renderer.render(document),
      });
    }
    return {
      fileName: `boletines-${safeFileName(classroom.name)}-${safeFileName(period.name)}.zip`,
      contentType: 'application/zip',
      content: await this.archiver.archive(entries),
    };
  }
}
