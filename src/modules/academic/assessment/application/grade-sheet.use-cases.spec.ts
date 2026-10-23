import { Role } from '../../../../shared/domain/role.js';
import { anActor } from '../../common/testing/actors.js';
import { AcademicWorld } from '../../common/testing/academic-world.js';
import { aStudent } from '../../common/testing/fake-directories.js';
import { AcademicPeriod } from '../../calendar/domain/academic-period.js';
import { GetGradeSheetUseCase } from './get-grade-sheet.use-case.js';
import { SaveGradeSheetUseCase, type SaveGradeSheetInput } from './save-grade-sheet.use-case.js';

describe('grade sheet use cases', () => {
  let w: AcademicWorld;
  let save: SaveGradeSheetUseCase;
  let sheet: GetGradeSheetUseCase;

  const input = (overrides: Partial<SaveGradeSheetInput> = {}): SaveGradeSheetInput => ({
    actor: w.actors.teacher,
    classroomId: 1,
    subjectId: 1,
    periodId: 1,
    entries: [
      { studentId: 1001, cognitive: 4, procedural: 3, attitudinal: 5, observations: 'Buen trabajo' },
      { studentId: 1002, cognitive: 2.5 },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
    save = new SaveGradeSheetUseCase(w.gradingContext, w.students, w.grades, w.uow);
    sheet = new GetGradeSheetUseCase(w.gradingContext, w.students, w.grades);
  });

  it('saves weighted grades of the open period and fills the legacy period number (B1)', async () => {
    await expect(save.execute(input())).resolves.toEqual({ saved: 2 });
    const [ana, bruno] = w.grades.store.all();
    expect(ana).toMatchObject({ studentId: 1001, periodId: 1, academicYear: 2026, periodNumber: 1 });
    expect(ana.finalScore.toNumber()).toBe(3.8);
    expect(bruno.finalScore.toNumber()).toBe(1.5);
    expect(w.uow.transactions).toBe(1);
  });

  it('upserts instead of duplicating grades', async () => {
    await save.execute(input());
    await save.execute(input({ entries: [{ studentId: 1001, cognitive: 5, procedural: 5, attitudinal: 5 }] }));
    expect(w.grades.store.all()).toHaveLength(2);
    expect(w.grades.store.all()[0].finalScore.toNumber()).toBe(5);
  });

  it('returns the sheet ordered by last name with performance levels', async () => {
    await save.execute(input());
    const view = await sheet.execute({ actor: w.actors.teacher, classroomId: 1, subjectId: 1 });
    expect(view).toMatchObject({
      editable: true,
      period: { id: 1 },
      weights: { cognitive: 60, procedural: 30, attitudinal: 10 },
    });
    expect(view.rows.map((r) => r.fullName)).toEqual(['ARIAS BRUNO', 'PÉREZ ANA']);
    expect(view.rows[1]).toMatchObject({ finalScore: 3.8, passing: true, performance: { level: 'basico' } });
    expect(view.rows[0]).toMatchObject({ finalScore: 1.5, passing: false });
  });

  it('shows empty rows for students without grades', async () => {
    const view = await sheet.execute({ actor: w.actors.admin, classroomId: 1, subjectId: 2 });
    expect(view.rows[0]).toMatchObject({ cognitive: null, finalScore: null, performance: null });
  });

  it('forbids teachers from grading subjects they are not assigned (S4)', async () => {
    await expect(save.execute(input({ subjectId: 2 }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(sheet.execute({ actor: w.actors.otherTeacher, classroomId: 1, subjectId: 1 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(save.execute(input({ actor: anActor(Role.TEACHER, 77) }))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets admins grade any assigned subject', async () => {
    await expect(save.execute(input({ actor: w.actors.admin, subjectId: 2 }))).resolves.toEqual({ saved: 2 });
  });

  it('only saves into the open period (B13, rule 18)', async () => {
    w.firstPeriod.close(w.clock.now());
    await expect(save.execute(input())).rejects.toMatchObject({ code: 'PERIOD_NOT_OPEN' });
    await expect(sheet.execute({ actor: w.actors.teacher, classroomId: 1, subjectId: 1 })).rejects.toMatchObject({
      code: 'NO_OPEN_PERIOD',
    });
    const readOnly = await sheet.execute({ actor: w.actors.teacher, classroomId: 1, subjectId: 1, periodId: 1 });
    expect(readOnly.editable).toBe(false);
  });

  it('rejects periods of another year and unassigned subjects', async () => {
    const other = AcademicPeriod.create({
      name: 'P',
      academicYear: 2025,
      startDate: '2025-02-01',
      endDate: '2025-03-01',
      open: true,
    });
    await w.periods.save(other);
    await expect(save.execute(input({ periodId: other.id as number }))).rejects.toMatchObject({
      code: 'PERIOD_NOT_IN_YEAR',
    });
    await w.structure.assignments.delete(1);
    await expect(save.execute(input())).rejects.toMatchObject({ code: 'SUBJECT_NOT_ASSIGNED' });
  });

  it('validates students and scores', async () => {
    w.students.add(aStudent({ id: 3001, classroomId: 2 }));
    await expect(save.execute(input({ entries: [{ studentId: 3001, cognitive: 4 }] }))).rejects.toMatchObject({
      code: 'STUDENT_NOT_IN_CLASSROOM',
    });
    await expect(save.execute(input({ entries: [{ studentId: 1001 }, { studentId: 1001 }] }))).rejects.toMatchObject({
      code: 'DUPLICATED_STUDENT',
    });
    await expect(save.execute(input({ entries: [{ studentId: 1001, cognitive: 5.5 }] }))).rejects.toMatchObject({
      code: 'INVALID_SCORE',
    });
    expect(w.grades.store.all()).toHaveLength(0);
  });
});
