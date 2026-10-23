import { AcademicWorld } from '../../common/testing/academic-world.js';
import { aStudent } from '../../common/testing/fake-directories.js';
import { AttendanceRecord } from '../../attendance/domain/attendance-record.js';
import { ComponentScores } from '../domain/component-scores.js';
import { StudentGrade } from '../domain/student-grade.js';
import { DownloadGroupReportCardsUseCase } from './download-group-report-cards.use-case.js';
import { DownloadReportCardPdfUseCase } from './download-report-card-pdf.use-case.js';
import { BULLETINS_GENERATED_EVENT, GenerateReportCardsUseCase } from './generate-report-cards.use-case.js';
import { GetGroupReportCardsUseCase } from './get-group-report-cards.use-case.js';
import { GetReportCardUseCase } from './get-report-card.use-case.js';
import { GetStudentGradesUseCase } from './get-student-grades.use-case.js';
import { ListStudentReportCardsUseCase } from './list-student-report-cards.use-case.js';
import type { DocumentArchiverPort } from './ports/document-archiver.port.js';
import type { ReportCardRendererPort } from './ports/report-card-renderer.port.js';

describe('report card use cases', () => {
  let w: AcademicWorld;
  const renderer: ReportCardRendererPort = { render: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) };
  const archiver: DocumentArchiverPort = { archive: vi.fn(async () => new Uint8Array([80, 75])) };

  const grade = (studentId: number, subjectId: number, cognitive: number, procedural: number, attitudinal: number) =>
    StudentGrade.record({
      studentId,
      subjectId,
      periodId: 1,
      academicYear: 2026,
      periodNumber: 1,
      scores: ComponentScores.of({ cognitive, procedural, attitudinal }),
      observations: subjectId === 1 ? 'Excelente' : null,
    });

  const generate = () => new GenerateReportCardsUseCase(w.periods, w.grades, w.reportCards, w.uow, w.events, w.clock);
  const getReportCard = () =>
    new GetReportCardUseCase(w.access, w.periods, w.reportCards, w.clock, w.reportCardBuilder);

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
    // Ana: math 3.8, spanish 4.6 → 4.2 ; Bruno: math 2.0 → 2.0 ; a withdrawn student keeps grades (B21)
    await w.grades.saveAll([
      grade(1001, 1, 4, 3, 5),
      grade(1001, 2, 5, 4, 4),
      grade(1002, 1, 2, 2, 2),
      grade(3001, 1, 3, 3, 3),
    ]);
    w.students.add(aStudent({ id: 3001, classroomId: null, isActive: false }));
  });

  describe('GenerateReportCardsUseCase', () => {
    it('refuses open periods (B18)', async () => {
      await expect(generate().execute(1)).rejects.toMatchObject({ code: 'INVALID_PERIOD_TRANSITION' });
    });

    it('stores one average per student, marks the period and publishes the event', async () => {
      w.firstPeriod.close(w.clock.now());
      await expect(generate().execute(1)).resolves.toEqual({ periodId: 1, generated: 3 });
      expect((await w.reportCards.findOne(1001, 1))?.averageScore).toBe(4.2);
      expect((await w.reportCards.findOne(1002, 1))?.averageScore).toBe(2);
      expect((await w.reportCards.findOne(3001, 1))?.averageScore).toBe(3);
      expect(w.firstPeriod.status).toBe('bulletins_generated');
      expect(w.events.published[0]).toMatchObject({
        name: BULLETINS_GENERATED_EVENT,
        payload: { periodId: 1, studentIds: [1001, 1002, 3001] },
      });
    });

    it('regenerates without duplicating and only touches its own cards (B3)', async () => {
      w.firstPeriod.close(w.clock.now());
      await generate().execute(1);
      w.grades.store.all()[2].regrade(ComponentScores.of({ cognitive: 5, procedural: 5, attitudinal: 5 }));
      await generate().execute(1);
      expect(w.reportCards.store.all()).toHaveLength(3);
      expect((await w.reportCards.findOne(1002, 1))?.averageScore).toBe(5);
      expect((await w.reportCards.findOne(1001, 1))?.averageScore).toBe(4.2);
    });

    it('fails when the period has no grades', async () => {
      w.firstPeriod.close(w.clock.now());
      w.grades.store.items.clear();
      await expect(generate().execute(1)).rejects.toMatchObject({ code: 'NO_GRADES_IN_PERIOD' });
      await expect(generate().execute(99)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('reading report cards', () => {
    beforeEach(async () => {
      w.firstPeriod.close(w.clock.now());
      await generate().execute(1);
    });

    it('lists the history of the student for the student and guardians (B24)', async () => {
      const list = new ListStudentReportCardsUseCase(w.access, w.reportCards, w.periods);
      const forParent = await list.execute({ actor: w.actors.parent, studentId: 1001 });
      expect(forParent).toEqual([
        expect.objectContaining({
          periodName: 'Primer Período',
          averageScore: 4.2,
          passing: true,
          performance: { level: 'alto', label: 'Alto' },
        }),
      ]);
      await expect(list.execute({ actor: w.actors.student, studentId: 1002 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('builds the document and counts views of students/guardians only (B23)', async () => {
      await w.attendance.save(
        AttendanceRecord.register({
          studentId: 1001,
          employeeId: 501,
          subjectId: 1,
          classroomId: 1,
          date: '2026-03-02',
          time: '07:00:00',
          status: 'absent',
          source: 'manual',
        }),
      );
      const doc = await getReportCard().execute({ actor: w.actors.student, studentId: 1001, periodId: 1 });
      expect(doc).toMatchObject({
        student: { fullName: 'PÉREZ ANA', code: 'E1001' },
        classroom: { name: '5A', gradeName: 'Quinto' },
        groupDirectorName: 'Laura Gómez',
        averageScore: 4.2,
        absences: 1,
        institution: { name: 'Colegio Demo' },
      });
      expect(doc.lines.map((l) => [l.area, l.subjectName, l.teacherName, l.finalScore])).toEqual([
        ['Ciencias', 'Matemáticas', 'Laura Gómez', 3.8],
        ['Humanidades', 'Español', 'Pedro Díaz', 4.6],
      ]);
      await getReportCard().execute({ actor: w.actors.admin, studentId: 1001, periodId: 1 });
      expect((await w.reportCards.findOne(1001, 1))?.viewCount).toBe(1);
    });

    it('protects report cards (S2) and requires them to exist', async () => {
      await expect(
        getReportCard().execute({ actor: w.actors.outsider, studentId: 1001, periodId: 1 }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        getReportCard().execute({ actor: w.actors.otherTeacher, studentId: 1001, periodId: 1 }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      w.reportCards.store.items.clear();
      await expect(
        getReportCard().execute({ actor: w.actors.admin, studentId: 1001, periodId: 1 }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('renders the PDF', async () => {
      const file = await new DownloadReportCardPdfUseCase(getReportCard(), renderer).execute({
        actor: w.actors.parent,
        studentId: 1001,
        periodId: 1,
      });
      expect(file).toMatchObject({ fileName: 'boletin-e1001-primer-periodo.pdf', contentType: 'application/pdf' });
    });

    it('summarizes the group for its director', async () => {
      const group = new GetGroupReportCardsUseCase(
        w.access,
        w.structure.classrooms,
        w.periods,
        w.students,
        w.reportCards,
      );
      const view = await group.execute({ actor: w.actors.teacher, classroomId: 1, periodId: 1 });
      expect(view.totals).toEqual({
        students: 2,
        generated: 2,
        groupAverage: 3.1,
        topStudent: { studentId: 1001, fullName: 'PÉREZ ANA', averageScore: 4.2 },
      });
      expect(view.rows.map((r) => [r.fullName, r.status, r.passing])).toEqual([
        ['ARIAS BRUNO', 'generated', false],
        ['PÉREZ ANA', 'generated', true],
      ]);
      await expect(group.execute({ actor: w.actors.otherTeacher, classroomId: 1, periodId: 1 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('zips the PDFs of the group', async () => {
      const zip = new DownloadGroupReportCardsUseCase(
        w.access,
        w.structure.classrooms,
        w.periods,
        w.students,
        w.reportCards,
        w.reportCardBuilder,
        renderer,
        archiver,
      );
      const file = await zip.execute({ actor: w.actors.admin, classroomId: 1, periodId: 1 });
      expect(file).toMatchObject({ fileName: 'boletines-5a-primer-periodo.zip', contentType: 'application/zip' });
      expect(archiver.archive).toHaveBeenCalledWith([
        expect.objectContaining({ fileName: 'e1002-arias-bruno.pdf' }),
        expect.objectContaining({ fileName: 'e1001-perez-ana.pdf' }),
      ]);
      w.reportCards.store.items.clear();
      await expect(zip.execute({ actor: w.actors.admin, classroomId: 1, periodId: 1 })).rejects.toMatchObject({
        code: 'NO_REPORT_CARDS',
      });
    });
  });

  describe('GetStudentGradesUseCase', () => {
    const studentGrades = () => new GetStudentGradesUseCase(w.access, w.grades, w.periods, w.settings, w.gradeLines);

    it('returns the latest period with grades, performance and average (B7)', async () => {
      const view = await studentGrades().execute({ actor: w.actors.student, studentId: 1001 });
      expect(view).toMatchObject({
        academicYear: 2026,
        selectedPeriodId: 1,
        periods: [{ id: 1, name: 'Primer Período', status: 'open' }],
        average: 4.2,
        averagePerformance: { level: 'alto' },
        passing: true,
      });
      expect(view.lines[0]).toMatchObject({
        subjectName: 'Matemáticas',
        performance: { label: 'Básico' },
        observations: 'Excelente',
      });
    });

    it('lets assigned teachers read grades but not unrelated users', async () => {
      await expect(studentGrades().execute({ actor: w.actors.otherTeacher, studentId: 1002 })).resolves.toMatchObject({
        average: 2,
        passing: false,
      });
      await expect(studentGrades().execute({ actor: w.actors.outsider, studentId: 1002 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('returns an empty view when there are no grades', async () => {
      const view = await studentGrades().execute({ actor: w.actors.admin, studentId: 1001, periodId: 1 });
      expect(view.selectedPeriodId).toBe(1);
      w.grades.store.items.clear();
      const empty = await studentGrades().execute({ actor: w.actors.admin, studentId: 1001 });
      expect(empty).toMatchObject({ periods: [], selectedPeriodId: null, lines: [], average: null, passing: null });
    });
  });
});
