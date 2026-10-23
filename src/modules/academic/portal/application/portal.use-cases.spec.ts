import { Role } from '../../../../shared/domain/role.js';
import { anActor } from '../../common/testing/actors.js';
import { AcademicWorld } from '../../common/testing/academic-world.js';
import { AttendanceRecord } from '../../attendance/domain/attendance-record.js';
import { Classroom } from '../../structure/domain/classroom.js';
import { GetDirectorDashboardUseCase } from './get-director-dashboard.use-case.js';
import { ListDirectedClassroomsUseCase } from './list-directed-classrooms.use-case.js';
import { ListMyTeachingAssignmentsUseCase } from './list-my-teaching-assignments.use-case.js';

describe('teacher portal use cases', () => {
  let w: AcademicWorld;

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
  });

  it('lists the teacher assignments of the year with student counts (B11, B28)', async () => {
    const list = new ListMyTeachingAssignmentsUseCase(
      w.access,
      w.structure.assignments,
      w.structure.classrooms,
      w.structure.subjects,
      w.structure.grades,
      w.students,
      w.settings,
    );
    expect(await list.execute({ actor: w.actors.teacher })).toEqual([
      expect.objectContaining({
        classroom: { id: 1, name: '5A', gradeName: 'Quinto' },
        subject: expect.objectContaining({ name: 'Matemáticas' }),
        studentsCount: 2,
      }),
    ]);
    expect(await list.execute({ actor: w.actors.teacher, year: 2025 })).toEqual([]);
    await expect(list.execute({ actor: anActor(Role.TEACHER, 99) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lists directed classrooms (admins see the whole year)', async () => {
    await w.structure.classrooms.save(Classroom.create({ gradeId: 1, name: '5B', academicYear: 2026 }));
    const list = new ListDirectedClassroomsUseCase(
      w.access,
      w.structure.directorships,
      w.structure.classrooms,
      w.settings,
      w.overview,
    );
    expect((await list.execute(w.actors.teacher)).map((c) => c.name)).toEqual(['5A']);
    expect(await list.execute(w.actors.otherTeacher)).toEqual([]);
    expect((await list.execute(w.actors.admin)).map((c) => c.name)).toEqual(['5A', '5B']);
  });

  it('builds the director dashboard with gender counts and monthly absences', async () => {
    for (const day of ['02', '03', '04', '05', '06', '09']) {
      await w.attendance.save(
        AttendanceRecord.register({
          studentId: 1002,
          employeeId: 501,
          subjectId: 1,
          classroomId: 1,
          date: `2026-03-${day}`,
          time: '07:00:00',
          status: 'absent',
          source: 'manual',
        }),
      );
    }
    const dashboard = new GetDirectorDashboardUseCase(
      w.access,
      w.structure.classrooms,
      w.students,
      w.attendance,
      w.clock,
      w.overview,
    );
    const view = await dashboard.execute({ actor: w.actors.teacher, classroomId: 1 });
    expect(view.totals).toEqual({ students: 2, boys: 1, girls: 1, monthlyAbsences: 6, critical: true });
    expect(view.students[0]).toMatchObject({ fullName: 'ARIAS BRUNO', documentNumber: '1101814265' });
    await expect(dashboard.execute({ actor: w.actors.otherTeacher, classroomId: 1 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
