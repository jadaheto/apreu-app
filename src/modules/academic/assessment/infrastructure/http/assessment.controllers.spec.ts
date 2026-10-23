import { StreamableFile } from '@nestjs/common';
import { Role } from '../../../../../shared/domain/role.js';
import { anActor } from '../../../common/testing/actors.js';
import { buildController } from '../../../common/testing/controller-harness.js';
import { DownloadGroupReportCardsUseCase } from '../../application/download-group-report-cards.use-case.js';
import { DownloadReportCardPdfUseCase } from '../../application/download-report-card-pdf.use-case.js';
import { GenerateReportCardsUseCase } from '../../application/generate-report-cards.use-case.js';
import { GetGradeSheetUseCase } from '../../application/get-grade-sheet.use-case.js';
import { GetGroupReportCardsUseCase } from '../../application/get-group-report-cards.use-case.js';
import { GetReportCardUseCase } from '../../application/get-report-card.use-case.js';
import { GetStudentGradesUseCase } from '../../application/get-student-grades.use-case.js';
import { ListStudentReportCardsUseCase } from '../../application/list-student-report-cards.use-case.js';
import { SaveGradeSheetUseCase } from '../../application/save-grade-sheet.use-case.js';
import { GradesController } from './grades.controller.js';
import { ReportCardsController } from './report-cards.controller.js';

const actor = anActor(Role.TEACHER, 10);

describe('GradesController', () => {
  it('passes the actor from the token to every use case', async () => {
    const { controller: c, mocks } = await buildController(GradesController, [
      GetGradeSheetUseCase,
      SaveGradeSheetUseCase,
      GetStudentGradesUseCase,
    ]);
    await c.sheet(actor, { classroomId: 1, subjectId: 2 });
    expect(mocks.get(GetGradeSheetUseCase)!.execute).toHaveBeenCalledWith({ actor, classroomId: 1, subjectId: 2 });
    const body = { classroomId: 1, subjectId: 2, periodId: 3, entries: [{ studentId: 4, cognitive: 4 }] };
    await c.save(actor, body);
    expect(mocks.get(SaveGradeSheetUseCase)!.execute).toHaveBeenCalledWith({ actor, ...body });
    await c.grades(actor, 4, { periodId: 3 });
    expect(mocks.get(GetStudentGradesUseCase)!.execute).toHaveBeenCalledWith({ actor, studentId: 4, periodId: 3 });
  });
});

describe('ReportCardsController', () => {
  it('delegates JSON endpoints and streams files', async () => {
    const { controller: c, mocks } = await buildController(ReportCardsController, [
      GenerateReportCardsUseCase,
      ListStudentReportCardsUseCase,
      GetReportCardUseCase,
      DownloadReportCardPdfUseCase,
      GetGroupReportCardsUseCase,
      DownloadGroupReportCardsUseCase,
    ]);
    const file = { fileName: 'b.pdf', contentType: 'application/pdf', content: new Uint8Array([1, 2]) };
    mocks.get(DownloadReportCardPdfUseCase)!.execute.mockResolvedValue(file);
    mocks.get(DownloadGroupReportCardsUseCase)!.execute.mockResolvedValue({ ...file, fileName: 'g.zip' });

    await c.generateForPeriod(3);
    expect(mocks.get(GenerateReportCardsUseCase)!.execute).toHaveBeenCalledWith(3);
    await c.history(actor, 4);
    expect(mocks.get(ListStudentReportCardsUseCase)!.execute).toHaveBeenCalledWith({ actor, studentId: 4 });
    await c.reportCard(actor, 4, 3);
    expect(mocks.get(GetReportCardUseCase)!.execute).toHaveBeenCalledWith({ actor, studentId: 4, periodId: 3 });
    await c.group(actor, 1, { periodId: 3 });
    expect(mocks.get(GetGroupReportCardsUseCase)!.execute).toHaveBeenCalledWith({ actor, classroomId: 1, periodId: 3 });

    const pdf = await c.pdf(actor, 4, 3);
    expect(pdf).toBeInstanceOf(StreamableFile);
    expect(pdf.getHeaders()).toMatchObject({ type: 'application/pdf', disposition: 'attachment; filename="b.pdf"' });
    const zip = await c.zip(actor, 1, { periodId: 3 });
    expect(zip.getHeaders().disposition).toBe('attachment; filename="g.zip"');
    expect(mocks.get(DownloadGroupReportCardsUseCase)!.execute).toHaveBeenCalledWith({
      actor,
      classroomId: 1,
      periodId: 3,
    });
  });
});
