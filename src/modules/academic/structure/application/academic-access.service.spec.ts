import { Role } from '../../../../shared/domain/role.js';
import { anActor } from '../../common/testing/actors.js';
import { AcademicWorld, USERS } from '../../common/testing/academic-world.js';
import { aStaffMember } from '../../common/testing/fake-directories.js';

describe('AcademicAccessService', () => {
  let w: AcademicWorld;

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
  });

  it('lets admins and superadmins read any student', async () => {
    await expect(w.access.readableStudent(w.actors.admin, 1002, 'grades')).resolves.toMatchObject({ id: 1002 });
    await expect(w.access.readableStudent(anActor(Role.SUPERADMIN), 1002, 'attendance')).resolves.toBeTruthy();
  });

  it('lets students and guardians read only their linked students', async () => {
    await expect(w.access.readableStudent(w.actors.student, 1001, 'grades')).resolves.toMatchObject({ id: 1001 });
    await expect(w.access.readableStudent(w.actors.parent, 1001, 'report-cards')).resolves.toBeTruthy();
    await expect(w.access.readableStudent(w.actors.student, 1002, 'grades')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(w.access.readableStudent(w.actors.outsider, 1001, 'grades')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets the group director read everything and classroom teachers only grades', async () => {
    await expect(w.access.readableStudent(w.actors.teacher, 1002, 'attendance')).resolves.toBeTruthy();
    await expect(w.access.readableStudent(w.actors.otherTeacher, 1002, 'grades')).resolves.toBeTruthy();
    await expect(w.access.readableStudent(w.actors.otherTeacher, 1002, 'report-cards')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects staff without relation to the student and unknown students', async () => {
    w.staff.add(aStaffMember({ id: 900 }), 90);
    await expect(w.access.readableStudent(anActor(Role.TEACHER, 90), 1001, 'grades')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(w.access.readableStudent(w.actors.admin, 5555, 'grades')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('checks group directorship', async () => {
    await expect(w.access.assertDirectorOf(w.actors.teacher, 1)).resolves.toBeUndefined();
    await expect(w.access.assertDirectorOf(w.actors.admin, 1)).resolves.toBeUndefined();
    await expect(w.access.assertDirectorOf(w.actors.otherTeacher, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.access.assertDirectorOf(anActor(Role.HR, USERS.outsider), 1)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
