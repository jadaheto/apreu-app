import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ChangeStudentStatusUseCase } from '../../application/change-student-status.use-case.js';
import { EnrollStudentUseCase } from '../../application/enroll-student.use-case.js';
import { GetStudentPhotoUseCase } from '../../application/get-student-photo.use-case.js';
import { GetStudentProfileUseCase } from '../../application/get-student-profile.use-case.js';
import { LinkStudentGuardianUseCase } from '../../application/link-student-guardian.use-case.js';
import { ListStudentsUseCase } from '../../application/list-students.use-case.js';
import { ProvisionPortalAccountsUseCase } from '../../application/provision-portal-accounts.use-case.js';
import { ResetPortalPasswordUseCase } from '../../application/reset-portal-password.use-case.js';
import { UpdateStudentUseCase } from '../../application/update-student.use-case.js';
import { UploadStudentPhotoUseCase } from '../../application/upload-student-photo.use-case.js';
import { actorOf } from '../../testing/students-test-kit.js';
import { EnrollStudentDto, ListStudentsQueryDto } from './dto/student.dto.js';
import { StudentsController } from './students.controller.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue({ ok: true }) });

describe('StudentsController', () => {
  const useCases = {
    list: mock(),
    enroll: mock(),
    profile: mock(),
    update: mock(),
    status: mock(),
    upload: mock(),
    photo: mock(),
    link: mock(),
    provision: mock(),
    reset: mock(),
  };
  const admin = actorOf(1, Role.ADMIN);
  const student = { firstName: 'S', lastName: 'G', documentNumber: '1' };
  let controller: StudentsController;

  beforeEach(async () => {
    Object.values(useCases).forEach((u) => u.execute.mockClear());
    const moduleRef = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: ListStudentsUseCase, useValue: useCases.list },
        { provide: EnrollStudentUseCase, useValue: useCases.enroll },
        { provide: GetStudentProfileUseCase, useValue: useCases.profile },
        { provide: UpdateStudentUseCase, useValue: useCases.update },
        { provide: ChangeStudentStatusUseCase, useValue: useCases.status },
        { provide: UploadStudentPhotoUseCase, useValue: useCases.upload },
        { provide: GetStudentPhotoUseCase, useValue: useCases.photo },
        { provide: LinkStudentGuardianUseCase, useValue: useCases.link },
        {
          provide: ProvisionPortalAccountsUseCase,
          useValue: useCases.provision,
        },
        { provide: ResetPortalPasswordUseCase, useValue: useCases.reset },
      ],
    }).compile();
    controller = moduleRef.get(StudentsController);
  });

  it('lists with filters and paging', async () => {
    const query = Object.assign(new ListStudentsQueryDto(), {
      page: 2,
      limit: 5,
      search: 'ana',
      status: 'active',
      year: 2026,
      gradeId: 3,
    });
    await controller.list(query);
    expect(useCases.list.execute).toHaveBeenCalledWith({
      criteria: {
        search: 'ana',
        status: 'active',
        gradeId: 3,
        classroomId: undefined,
        academicYear: 2026,
      },
      page: { page: 2, limit: 5 },
    });
  });

  it.each([
    [
      {
        guardianId: 4,
        guardian: { documentNumber: '1', firstName: 'a', lastName: 'b' },
      },
      { guardianId: 4 },
    ],
    [
      { guardian: { documentNumber: '1', firstName: 'a', lastName: 'b' } },
      { details: { documentNumber: '1', firstName: 'a', lastName: 'b' } },
    ],
    [{}, null],
  ])('enrolls mapping the guardian selection %o', async (extra, guardian) => {
    await controller.enroll(
      Object.assign(new EnrollStudentDto(), {
        student,
        classroomId: 10,
        ...extra,
      }),
    );
    expect(useCases.enroll.execute).toHaveBeenCalledWith(
      expect.objectContaining({ details: student, classroomId: 10, guardian }),
    );
  });

  it('delegates profile, update, status, guardian and accounts endpoints', async () => {
    await controller.profile(7);
    expect(useCases.profile.execute).toHaveBeenCalledWith(7);

    await controller.update(7, { ...student, classroomId: null });
    expect(useCases.update.execute).toHaveBeenCalledWith({
      studentId: 7,
      details: student,
      classroomId: null,
    });

    await controller.status(7, { status: 'withdrawn', reason: 'Traslado' });
    expect(useCases.status.execute).toHaveBeenCalledWith({
      studentId: 7,
      status: 'withdrawn',
      reason: 'Traslado',
    });

    await controller.setGuardian(7, { guardianId: 3 });
    await controller.removeGuardian(7);
    expect(useCases.link.execute.mock.calls).toEqual([
      [{ studentId: 7, guardianId: 3 }],
      [{ studentId: 7, guardianId: null }],
    ]);

    await controller.portalAccounts(7);
    expect(useCases.provision.execute).toHaveBeenCalledWith(7);
    await controller.resetPortalPassword(7, { holder: 'guardian' });
    expect(useCases.reset.execute).toHaveBeenCalledWith({
      studentId: 7,
      holder: 'guardian',
    });
  });

  it('uploads photos and tolerates a missing file (validated by the use case)', async () => {
    const buffer = Buffer.from([1]);
    await controller.putPhoto(7, {
      originalname: 'a.jpg',
      mimetype: 'image/jpeg',
      buffer,
    });
    expect(useCases.upload.execute).toHaveBeenCalledWith({
      studentId: 7,
      originalName: 'a.jpg',
      mimeType: 'image/jpeg',
      content: buffer,
    });
    await controller.putPhoto(7, undefined);
    expect(useCases.upload.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        originalName: '',
        mimeType: '',
        content: new Uint8Array(),
      }),
    );
  });

  it('streams the photo with its MIME type', async () => {
    useCases.photo.execute.mockResolvedValueOnce({
      content: new Uint8Array([1, 2]),
      mimeType: 'image/png',
    });
    const file = await controller.photo(admin, 7);
    expect(useCases.photo.execute).toHaveBeenCalledWith({
      actor: admin,
      studentId: 7,
    });
    expect(file.getHeaders()).toMatchObject({
      type: 'image/png',
      disposition: 'inline',
    });
  });

  it('restricts writes to admin', () => {
    const roles = (method: keyof StudentsController) =>
      Reflect.getMetadata(ROLES_KEY, StudentsController.prototype[method]);
    expect(roles('enroll')).toEqual([Role.ADMIN]);
    expect(roles('update')).toEqual([Role.ADMIN]);
    expect(roles('putPhoto')).toEqual([Role.ADMIN]);
    expect(roles('list')).toEqual([Role.ADMIN, Role.FINANCE, Role.HR]);
  });
});
