import { buildController } from '../../../common/testing/controller-harness.js';
import { AddSubjectUseCase } from '../../application/add-subject.use-case.js';
import { AssignGroupDirectorUseCase } from '../../application/assign-group-director.use-case.js';
import { AssignTeacherUseCase } from '../../application/assign-teacher.use-case.js';
import { ChangeAssignmentTeacherUseCase } from '../../application/change-assignment-teacher.use-case.js';
import { CreateClassroomUseCase } from '../../application/create-classroom.use-case.js';
import { CreateGradeUseCase } from '../../application/create-grade.use-case.js';
import { DeleteClassroomUseCase } from '../../application/delete-classroom.use-case.js';
import { DeleteGradeUseCase } from '../../application/delete-grade.use-case.js';
import { GetAcademicDashboardUseCase } from '../../application/get-academic-dashboard.use-case.js';
import { ListClassroomAssignmentsUseCase } from '../../application/list-classroom-assignments.use-case.js';
import { ListClassroomsUseCase } from '../../application/list-classrooms.use-case.js';
import { ListGradeSubjectsUseCase } from '../../application/list-grade-subjects.use-case.js';
import { ListGradesUseCase } from '../../application/list-grades.use-case.js';
import { ListTeachingStaffUseCase } from '../../application/list-teaching-staff.use-case.js';
import { RemoveAssignmentUseCase } from '../../application/remove-assignment.use-case.js';
import { RemoveSubjectUseCase } from '../../application/remove-subject.use-case.js';
import { UpdateClassroomUseCase } from '../../application/update-classroom.use-case.js';
import { UpdateGradeUseCase } from '../../application/update-grade.use-case.js';
import { UpdateSubjectUseCase } from '../../application/update-subject.use-case.js';
import { ClassroomsController } from './classrooms.controller.js';
import { CurriculumController } from './curriculum.controller.js';

describe('CurriculumController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller: c, mocks } = await buildController(CurriculumController, [
      GetAcademicDashboardUseCase,
      ListGradesUseCase,
      CreateGradeUseCase,
      UpdateGradeUseCase,
      DeleteGradeUseCase,
      ListGradeSubjectsUseCase,
      AddSubjectUseCase,
      UpdateSubjectUseCase,
      RemoveSubjectUseCase,
      ListTeachingStaffUseCase,
    ]);
    const called = (useCase: Parameters<typeof mocks.get>[0]) => mocks.get(useCase)!.execute;

    await expect(c.getDashboard({ year: 2025 })).resolves.toEqual({ ok: true });
    expect(called(GetAcademicDashboardUseCase)).toHaveBeenCalledWith({ year: 2025 });
    await c.grades();
    expect(called(ListGradesUseCase)).toHaveBeenCalled();
    await c.create({ name: 'Primero' });
    expect(called(CreateGradeUseCase)).toHaveBeenCalledWith({ name: 'Primero' });
    await c.update(3, { name: 'Segundo', level: 'primaria' });
    expect(called(UpdateGradeUseCase)).toHaveBeenCalledWith({ gradeId: 3, name: 'Segundo', level: 'primaria' });
    await expect(c.remove(3)).resolves.toBeUndefined();
    expect(called(DeleteGradeUseCase)).toHaveBeenCalledWith(3);
    await c.subjects(3);
    expect(called(ListGradeSubjectsUseCase)).toHaveBeenCalledWith(3);
    await c.createSubject(3, { name: 'Mat' });
    expect(called(AddSubjectUseCase)).toHaveBeenCalledWith({ gradeId: 3, name: 'Mat' });
    await c.editSubject(8, { name: 'Mat', hoursPerWeek: 4 });
    expect(called(UpdateSubjectUseCase)).toHaveBeenCalledWith({ subjectId: 8, name: 'Mat', hoursPerWeek: 4 });
    await c.deleteSubject(8);
    expect(called(RemoveSubjectUseCase)).toHaveBeenCalledWith(8);
    await c.teachers();
    expect(called(ListTeachingStaffUseCase)).toHaveBeenCalled();
  });
});

describe('ClassroomsController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller: c, mocks } = await buildController(ClassroomsController, [
      ListClassroomsUseCase,
      CreateClassroomUseCase,
      UpdateClassroomUseCase,
      DeleteClassroomUseCase,
      AssignGroupDirectorUseCase,
      ListClassroomAssignmentsUseCase,
      AssignTeacherUseCase,
      ChangeAssignmentTeacherUseCase,
      RemoveAssignmentUseCase,
    ]);
    const called = (useCase: Parameters<typeof mocks.get>[0]) => mocks.get(useCase)!.execute;

    await c.list({});
    expect(called(ListClassroomsUseCase)).toHaveBeenCalledWith({ year: undefined });
    await c.create({ gradeId: 1, name: '5A' });
    expect(called(CreateClassroomUseCase)).toHaveBeenCalledWith({ gradeId: 1, name: '5A' });
    await c.update(2, { gradeId: 1, name: '5B', academicYear: 2026 });
    expect(called(UpdateClassroomUseCase)).toHaveBeenCalledWith({
      classroomId: 2,
      gradeId: 1,
      name: '5B',
      academicYear: 2026,
    });
    await c.remove(2);
    expect(called(DeleteClassroomUseCase)).toHaveBeenCalledWith(2);
    await c.director(2, { employeeId: null });
    expect(called(AssignGroupDirectorUseCase)).toHaveBeenCalledWith({ classroomId: 2, employeeId: null });
    await c.assignments(2);
    expect(called(ListClassroomAssignmentsUseCase)).toHaveBeenCalledWith(2);
    await c.assign({ employeeId: 5, subjectId: 6, classroomId: 2 });
    expect(called(AssignTeacherUseCase)).toHaveBeenCalledWith({ employeeId: 5, subjectId: 6, classroomId: 2 });
    await c.reassign(9, { employeeId: 7 });
    expect(called(ChangeAssignmentTeacherUseCase)).toHaveBeenCalledWith({ assignmentId: 9, employeeId: 7 });
    await c.unassign(9);
    expect(called(RemoveAssignmentUseCase)).toHaveBeenCalledWith(9);
  });
});
