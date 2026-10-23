import { AcademicWorld } from '../../common/testing/academic-world.js';
import { aStaffMember, aStudent } from '../../common/testing/fake-directories.js';
import { Classroom } from '../domain/classroom.js';
import { Subject } from '../domain/subject.js';
import { AddSubjectUseCase } from './add-subject.use-case.js';
import { AssignGroupDirectorUseCase } from './assign-group-director.use-case.js';
import { AssignTeacherUseCase } from './assign-teacher.use-case.js';
import { ChangeAssignmentTeacherUseCase } from './change-assignment-teacher.use-case.js';
import { CreateClassroomUseCase } from './create-classroom.use-case.js';
import { CreateGradeUseCase } from './create-grade.use-case.js';
import { DeleteClassroomUseCase } from './delete-classroom.use-case.js';
import { DeleteGradeUseCase } from './delete-grade.use-case.js';
import { GetAcademicDashboardUseCase } from './get-academic-dashboard.use-case.js';
import { ListClassroomAssignmentsUseCase } from './list-classroom-assignments.use-case.js';
import { ListClassroomsUseCase } from './list-classrooms.use-case.js';
import { ListGradeSubjectsUseCase } from './list-grade-subjects.use-case.js';
import { ListGradesUseCase } from './list-grades.use-case.js';
import { ListTeachingStaffUseCase } from './list-teaching-staff.use-case.js';
import { RemoveAssignmentUseCase } from './remove-assignment.use-case.js';
import { RemoveSubjectUseCase } from './remove-subject.use-case.js';
import { UpdateClassroomUseCase } from './update-classroom.use-case.js';
import { UpdateGradeUseCase } from './update-grade.use-case.js';
import { UpdateSubjectUseCase } from './update-subject.use-case.js';

describe('structure use cases', () => {
  let w: AcademicWorld;
  let s: AcademicWorld['structure'];

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
    s = w.structure;
  });

  describe('grades', () => {
    it('creates, lists ordered by level and updates', async () => {
      await new CreateGradeUseCase(s.grades).execute({ name: 'Transición', level: 'preescolar' });
      const list = await new ListGradesUseCase(s.grades).execute();
      expect(list.map((g) => g.name)).toEqual(['Transición', 'Quinto']);
      const updated = await new UpdateGradeUseCase(s.grades).execute({
        gradeId: 1,
        name: 'Quinto B',
        level: 'primaria',
      });
      expect(updated.name).toBe('Quinto B');
    });

    it('refuses to delete grades with classrooms or subjects instead of cascading', async () => {
      const remove = new DeleteGradeUseCase(s.grades, s.subjects, s.classrooms);
      await expect(remove.execute(1)).rejects.toMatchObject({ code: 'CONFLICT' });
      const empty = await new CreateGradeUseCase(s.grades).execute({ name: 'Once', level: 'media' });
      await remove.execute(empty.id);
      expect(await s.grades.findById(empty.id)).toBeNull();
      await expect(remove.execute(999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('subjects', () => {
    it('manages the curriculum of a grade', async () => {
      const added = await new AddSubjectUseCase(s.grades, s.subjects).execute({
        gradeId: 1,
        name: 'Inglés',
        code: 'ing',
      });
      expect(added).toMatchObject({ code: 'ING', hoursPerWeek: 1 });
      await new UpdateSubjectUseCase(s.subjects).execute({ subjectId: added.id, name: 'Inglés', hoursPerWeek: 3 });
      const curriculum = await new ListGradeSubjectsUseCase(s.grades, s.subjects).execute(1);
      expect(curriculum.grade.name).toBe('Quinto');
      expect(curriculum.subjects.find((x) => x.id === added.id)?.hoursPerWeek).toBe(3);
      await new RemoveSubjectUseCase(s.subjects).execute(added.id);
      expect(await s.subjects.findById(added.id)).toBeNull();
    });

    it('does not add subjects to unknown grades nor delete subjects with records', async () => {
      await expect(
        new AddSubjectUseCase(s.grades, s.subjects).execute({ gradeId: 99, name: 'X' }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      s.subjects.referenced.add(1);
      await expect(new RemoveSubjectUseCase(s.subjects).execute(1)).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('classrooms', () => {
    it('creates classrooms in the current academic year by default', async () => {
      const view = await new CreateClassroomUseCase(s.classrooms, s.grades, w.settings, w.overview).execute({
        gradeId: 1,
        name: '5B',
      });
      expect(view).toMatchObject({
        academicYear: 2026,
        capacity: 30,
        gradeName: 'Quinto',
        studentsCount: 0,
        director: null,
      });
    });

    it('lists classrooms with director and active students', async () => {
      w.students.add(aStudent({ classroomId: 1, isActive: false }));
      const [view] = await new ListClassroomsUseCase(s.classrooms, w.settings, w.overview).execute({});
      expect(view).toMatchObject({ name: '5A', studentsCount: 2, director: { employeeId: 501, name: 'Laura Gómez' } });
      expect(await new ListClassroomsUseCase(s.classrooms, w.settings, w.overview).execute({ year: 2025 })).toEqual([]);
    });

    it('does not move a classroom with teaching load to another year or grade', async () => {
      const update = new UpdateClassroomUseCase(s.classrooms, s.grades, s.assignments, w.overview);
      await expect(
        update.execute({ classroomId: 1, gradeId: 1, name: '5A', academicYear: 2027 }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const renamed = await update.execute({
        classroomId: 1,
        gradeId: 1,
        name: '5-A',
        capacity: 2,
        academicYear: 2026,
      });
      expect(renamed).toMatchObject({ name: '5-A', isFull: true });
    });

    it('deletes only empty classrooms', async () => {
      const remove = new DeleteClassroomUseCase(s.classrooms, s.assignments, w.students);
      await expect(remove.execute(1)).rejects.toMatchObject({ code: 'CONFLICT' });
      const empty = Classroom.create({ gradeId: 1, name: '5C', academicYear: 2026 });
      await s.classrooms.save(empty);
      await remove.execute(empty.id as number);
      expect(await s.classrooms.findById(empty.id as number)).toBeNull();
    });
  });

  describe('group director', () => {
    const assign = (employeeId: number | null) =>
      new AssignGroupDirectorUseCase(s.classrooms, s.directorships, w.staff, w.uow, w.clock).execute({
        classroomId: 1,
        employeeId,
      });

    it('replaces the director keeping history, any number of times (B5)', async () => {
      await assign(502);
      await assign(501);
      await assign(null);
      const rows = s.directorships.store.all();
      expect(rows).toHaveLength(3);
      expect(rows.filter((d) => d.isActive)).toHaveLength(0);
      await assign(502);
      expect((await s.directorships.findActiveByClassroom(1))?.employeeId).toBe(502);
      expect((await s.directorships.findActiveByClassroom(1))?.assignedOn).toBe('2026-03-15');
      expect(w.uow.transactions).toBe(4);
    });

    it('is a no-op when the director does not change', async () => {
      await assign(501);
      expect(s.directorships.store.all()).toHaveLength(1);
    });

    it('only accepts active teachers or directors', async () => {
      w.staff.add(aStaffMember({ id: 700, employeeType: 'servicios' }));
      await expect(assign(700)).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_ELIGIBLE' });
      await expect(assign(999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('teaching load', () => {
    const assignTeacher = () => new AssignTeacherUseCase(s.assignments, s.classrooms, s.subjects, w.staff);

    it('lists every subject of the grade with its teacher', async () => {
      const extra = Subject.create(1, { name: 'Artes', area: 'Artística' });
      await s.subjects.save(extra);
      const load = await new ListClassroomAssignmentsUseCase(
        s.classrooms,
        s.subjects,
        s.assignments,
        w.staff,
        w.overview,
      ).execute(1);
      expect(load.lines).toHaveLength(3);
      expect(load.lines.find((l) => l.subject.name === 'Artes')).toMatchObject({ assignmentId: null, teacher: null });
      expect(load.lines.find((l) => l.subject.name === 'Matemáticas')?.teacher?.name).toBe('Laura Gómez');
    });

    it('assigns one teacher per subject, classroom and year', async () => {
      await expect(assignTeacher().execute({ employeeId: 502, subjectId: 1, classroomId: 1 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const extra = Subject.create(1, { name: 'Artes' });
      await s.subjects.save(extra);
      const created = await assignTeacher().execute({ employeeId: 502, subjectId: extra.id as number, classroomId: 1 });
      expect(created).toMatchObject({ academicYear: 2026, employeeId: 502 });
    });

    it('rejects subjects of another grade', async () => {
      const foreign = Subject.create(2, { name: 'Química' });
      await s.subjects.save(foreign);
      await expect(
        assignTeacher().execute({ employeeId: 502, subjectId: foreign.id as number, classroomId: 1 }),
      ).rejects.toMatchObject({ code: 'SUBJECT_NOT_IN_GRADE' });
    });

    it('changes the teacher (B6) and removes assignments', async () => {
      const changed = await new ChangeAssignmentTeacherUseCase(s.assignments, w.staff).execute({
        assignmentId: 1,
        employeeId: 502,
      });
      expect(changed.employeeId).toBe(502);
      await new RemoveAssignmentUseCase(s.assignments).execute(1);
      expect(await s.assignments.findById(1)).toBeNull();
      await expect(new RemoveAssignmentUseCase(s.assignments).execute(1)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lists the eligible teaching staff', async () => {
      w.staff.add(aStaffMember({ id: 800, status: 'inactive' }));
      const staff = await new ListTeachingStaffUseCase(w.staff).execute();
      expect(staff.map((t) => t.id)).toEqual([501, 502]);
    });
  });

  it('builds the dashboard counting only students of the selected year (B26)', async () => {
    await s.classrooms.save(Classroom.create({ gradeId: 1, name: '5A', academicYear: 2025 }));
    w.students.add(aStudent({ classroomId: 2 }));
    const dashboard = await new GetAcademicDashboardUseCase(
      s.grades,
      s.subjects,
      s.classrooms,
      s.assignments,
      w.settings,
      w.overview,
    ).execute({});
    expect(dashboard.academicYear).toBe(2026);
    expect(dashboard.totals).toEqual({ grades: 1, classrooms: 1, teachingAssignments: 2 });
    expect(dashboard.grades[0]).toMatchObject({ subjectsCount: 2, classroomsCount: 1, studentsCount: 2 });
  });
});
