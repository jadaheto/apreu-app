import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { actorOf, createStudentsKit, type StudentsKit } from '../testing/students-test-kit.js';

describe('StudentAccessPolicy', () => {
  let kit: StudentsKit;
  beforeEach(() => {
    kit = createStudentsKit();
  });

  it('lets superadmin and the given staff roles see any student', async () => {
    const student = await kit.addStudent();
    const id = student.id as number;
    await expect(kit.access.load(actorOf(1, Role.SUPERADMIN), id, [])).resolves.toBe(student);
    await expect(kit.access.load(actorOf(1, Role.FINANCE), id)).resolves.toBe(student);
    await expect(kit.access.load(actorOf(1, Role.FINANCE), id, [Role.ADMIN])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(kit.access.load(actorOf(1, Role.TEACHER), id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lets a student see only itself', async () => {
    const student = await kit.addStudent();
    student.linkUser(10);
    await expect(kit.access.canAccess(actorOf(10, Role.STUDENT), student, [])).resolves.toBe(true);
    await expect(kit.access.canAccess(actorOf(11, Role.STUDENT), student, [])).resolves.toBe(false);
  });

  it('lets a guardian see only the students linked to their guardian record', async () => {
    const guardian = await kit.addGuardian();
    guardian.linkUser(20);
    const child = await kit.addStudent({}, { guardianId: guardian.id });
    const orphan = await kit.addStudent();
    await expect(kit.access.canAccess(actorOf(20, Role.PARENT), child, [])).resolves.toBe(true);
    await expect(kit.access.canAccess(actorOf(21, Role.PARENT), child, [])).resolves.toBe(false);
    await expect(kit.access.canAccess(actorOf(20, Role.PARENT), orphan, [])).resolves.toBe(false);
  });

  it('fails for unknown students', async () => {
    await expect(kit.access.load(actorOf(1, Role.ADMIN), 404)).rejects.toBeInstanceOf(NotFoundError);
  });
});
