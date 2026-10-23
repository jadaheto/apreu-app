import { Role } from '../../../../../shared/domain/role.js';
import { anActor } from '../../../common/testing/actors.js';
import { buildController } from '../../../common/testing/controller-harness.js';
import { GetDirectorDashboardUseCase } from '../../application/get-director-dashboard.use-case.js';
import { ListDirectedClassroomsUseCase } from '../../application/list-directed-classrooms.use-case.js';
import { ListMyTeachingAssignmentsUseCase } from '../../application/list-my-teaching-assignments.use-case.js';
import { TeacherPortalController } from './teacher-portal.controller.js';

describe('TeacherPortalController', () => {
  it('delegates each endpoint with the actor from the token', async () => {
    const actor = anActor(Role.TEACHER, 10);
    const { controller: c, mocks } = await buildController(TeacherPortalController, [
      ListMyTeachingAssignmentsUseCase,
      ListDirectedClassroomsUseCase,
      GetDirectorDashboardUseCase,
    ]);
    await c.assignments(actor, { year: 2026 });
    expect(mocks.get(ListMyTeachingAssignmentsUseCase)!.execute).toHaveBeenCalledWith({ actor, year: 2026 });
    await c.classrooms(actor);
    expect(mocks.get(ListDirectedClassroomsUseCase)!.execute).toHaveBeenCalledWith(actor);
    await c.dashboard(actor, 5);
    expect(mocks.get(GetDirectorDashboardUseCase)!.execute).toHaveBeenCalledWith({ actor, classroomId: 5 });
  });
});
