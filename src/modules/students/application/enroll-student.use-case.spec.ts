import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import {
  CLASSROOM_2025,
  createStudentsKit,
  guardianDetails,
  studentDetails,
  type StudentsKit,
} from '../testing/students-test-kit.js';
import { EnrollStudentUseCase, type EnrollStudentInput } from './enroll-student.use-case.js';
import { STUDENT_ENROLLED } from './integration-events.js';

describe('EnrollStudentUseCase', () => {
  let kit: StudentsKit;
  let useCase: EnrollStudentUseCase;

  const enroll = (override: Partial<EnrollStudentInput> = {}) =>
    useCase.execute({
      details: studentDetails(),
      classroomId: 10,
      guardian: { details: guardianDetails() },
      ...override,
    });

  beforeEach(() => {
    kit = createStudentsKit();
    useCase = new EnrollStudentUseCase(
      kit.students,
      kit.guardians,
      kit.sequence,
      kit.settings,
      kit.unitOfWork,
      kit.events,
      kit.clock,
      kit.placement,
      kit.provisioner,
      kit.studentViews,
    );
  });

  it('enrolls the student with code, classroom, guardian and portal accounts in one transaction', async () => {
    const result = await enroll();

    expect(kit.unitOfWork.transactions).toBe(1);
    expect(result.student).toMatchObject({
      code: 'AL20260001',
      fullName: 'Sofía Gómez',
      status: 'active',
      enrollmentDate: '2026-03-15',
      academicYear: 2026,
      hasPortalAccount: true,
      placement: { classroomId: 10, gradeName: 'Quinto' },
      guardianDetails: { documentNumber: '52123456', hasPortalAccount: true },
    });
    expect(result.guardianReused).toBe(false);
    expect(result.accounts).toEqual([
      expect.objectContaining({
        holder: 'student',
        status: 'created',
        email: 'al20260001@apreu.co',
        temporaryPassword: 'Temporal1x',
      }),
      expect.objectContaining({
        holder: 'guardian',
        status: 'created',
        email: 'marta@correo.co',
        temporaryPassword: 'Temporal2x',
      }),
    ]);
    const studentUser = kit.users.accounts[0];
    expect(studentUser).toMatchObject({
      role: Role.STUDENT,
      passwordHash: 'hashed:Temporal1x',
    });
    expect(kit.students.store.get(result.student.id)?.userId).toBe(studentUser.id);
  });

  it('publishes students.student-enrolled after committing', async () => {
    const result = await enroll();
    expect(kit.events.published).toEqual([
      expect.objectContaining({
        name: STUDENT_ENROLLED,
        payload: {
          studentId: result.student.id,
          code: 'AL20260001',
          fullName: 'Sofía Gómez',
          gradeId: 5,
          classroomId: 10,
          documentNumber: '1101814264',
          guardianEmail: 'marta@correo.co',
        },
      }),
    ]);
  });

  it('reuses the guardian of a sibling instead of duplicating it (bug B10)', async () => {
    await enroll();
    const sibling = await enroll({
      details: studentDetails({ firstName: 'Juan', documentNumber: '999' }),
    });

    expect(sibling.guardianReused).toBe(true);
    expect(kit.guardians.store.all()).toHaveLength(1);
    expect(sibling.student.guardianDetails?.id).toBe(kit.guardians.store.all()[0].id);
    expect(sibling.accounts[1]).toMatchObject({
      holder: 'guardian',
      status: 'already_linked',
      temporaryPassword: null,
    });
    expect(sibling.student.code).toBe('AL20260002');
  });

  it('accepts an existing guardian by id and fails for unknown ids', async () => {
    const guardian = await kit.addGuardian({
      documentNumber: '777',
      email: null,
    });
    const result = await enroll({
      guardian: { guardianId: guardian.id as number },
    });
    expect(result.guardianReused).toBe(true);
    expect(result.accounts[1]).toMatchObject({ status: 'skipped' });
    await expect(
      enroll({
        guardian: { guardianId: 404 },
        details: studentDetails({ documentNumber: '2' }),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('skips codes already used by legacy data (bug B11)', async () => {
    await kit.addStudent(); // legacy code AL20260101
    kit.sequence.counters.set(2026, 100);
    const result = await enroll();
    expect(result.student.code).toBe('AL20260102');
  });

  it('rejects a duplicated student document', async () => {
    await enroll();
    await expect(enroll()).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects classrooms of another academic year', async () => {
    await expect(enroll({ classroomId: CLASSROOM_2025.id })).rejects.toMatchObject({
      code: 'CLASSROOM_NOT_IN_ACADEMIC_YEAR',
    });
    await expect(enroll({ classroomId: 999 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('can enroll without guardian, classroom nor accounts', async () => {
    const result = await enroll({
      guardian: null,
      classroomId: null,
      createPortalAccounts: false,
      enrollmentDate: '2026-02-01',
    });
    expect(result.accounts).toEqual([]);
    expect(result.student).toMatchObject({
      placement: null,
      guardianDetails: null,
      hasPortalAccount: false,
      enrollmentDate: '2026-02-01',
    });
    expect(kit.events.published[0].payload).toMatchObject({
      gradeId: null,
      classroomId: null,
      guardianEmail: null,
    });
  });

  it('uses the calendar year when the academic year is not configured', async () => {
    kit.settings.profile.academicYear = null;
    const result = await enroll({ classroomId: null });
    expect(result.student.code).toBe('AL20260001');
  });
});
