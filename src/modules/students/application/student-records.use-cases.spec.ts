import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { Incident } from '../domain/incident.js';
import {
  actorOf,
  CLASSROOM_2025,
  createStudentsKit,
  studentDetails,
  type StudentsKit,
} from '../testing/students-test-kit.js';
import { ChangeStudentStatusUseCase } from './change-student-status.use-case.js';
import { GetStudentDetailsUseCase } from './get-student-details.use-case.js';
import { GetStudentPhotoUseCase } from './get-student-photo.use-case.js';
import { GetStudentProfileUseCase } from './get-student-profile.use-case.js';
import { STUDENT_STATUS_CHANGED } from './integration-events.js';
import { LinkStudentGuardianUseCase } from './link-student-guardian.use-case.js';
import { ListStudentsUseCase } from './list-students.use-case.js';
import { UpdateStudentUseCase } from './update-student.use-case.js';
import { UploadStudentPhotoUseCase } from './upload-student-photo.use-case.js';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

describe('student records use cases', () => {
  let kit: StudentsKit;
  beforeEach(() => {
    kit = createStudentsKit();
  });

  describe('ListStudentsUseCase', () => {
    it('lists students with placement and guardian, filtered and paginated', async () => {
      const guardian = await kit.addGuardian();
      await kit.addStudent({ firstName: 'Ana', lastName: 'Zapata' }, { guardianId: guardian.id });
      await kit.addStudent({ firstName: 'Beto', lastName: 'Arias' }, { classroomId: CLASSROOM_2025.id });
      await kit.addStudent({ firstName: 'Carla', lastName: 'Mejía' }, { classroomId: null });

      const useCase = new ListStudentsUseCase(kit.students, kit.studentViews);
      const page = await useCase.execute({
        criteria: { academicYear: 2026 },
        page: { page: 1, limit: 10 },
      });

      expect(page.total).toBe(2);
      expect(page.items.map((s) => s.fullName)).toEqual(['Carla Mejía', 'Ana Zapata']);
      expect(page.items[1]).toMatchObject({
        placement: { gradeName: 'Quinto', classroomName: 'A' },
        guardian: { fullName: 'Marta Ruiz', mobile: '3001234567' },
      });
      const search = await useCase.execute({
        criteria: { search: 'beto' },
        page: { page: 1, limit: 10 },
      });
      expect(search.items.map((s) => s.firstName)).toEqual(['Beto']);
    });
  });

  describe('GetStudentProfileUseCase', () => {
    it('aggregates record, finance, incidents with names and certificates', async () => {
      const student = await kit.addStudent();
      const reviewer = kit.users.add('rev@c.co', Role.HR, 'Revisora');
      const incident = Incident.open({
        studentId: student.id,
        requestedBy: reviewer.id,
        title: 'Salida',
        openedAt: kit.clock.now(),
      });
      incident.review('approved', reviewer.id, 'Ok', kit.clock.now());
      await kit.incidents.save(incident);
      kit.finance.summaryResult = {
        charged: 100,
        paid: 40,
        balance: 60,
        overdueCount: 1,
      };

      const profile = await new GetStudentProfileUseCase(
        kit.students,
        kit.incidents,
        kit.certificates,
        kit.finance,
        kit.clock,
        kit.studentViews,
        kit.incidentViews,
      ).execute(student.id as number);

      expect(profile.student.code).toBe(student.code.toString());
      expect(profile.finance).toMatchObject({
        balance: 60,
        recentPayments: [],
      });
      expect(profile.incidents[0]).toMatchObject({
        studentName: 'Sofía Gómez',
        reviewedByName: 'Revisora',
        requestedByName: 'Revisora',
      });
      expect(profile.certificates).toEqual([]);
      expect(kit.finance.calls).toContainEqual({
        method: 'payments',
        args: [student.id, 5],
      });
    });

    it('fails for unknown students', async () => {
      const useCase = new GetStudentProfileUseCase(
        kit.students,
        kit.incidents,
        kit.certificates,
        kit.finance,
        kit.clock,
        kit.studentViews,
        kit.incidentViews,
      );
      await expect(useCase.execute(1)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('GetStudentDetailsUseCase', () => {
    it('returns the record to its owner and rejects other students (IDOR S3)', async () => {
      const student = await kit.addStudent();
      student.linkUser(50);
      const useCase = new GetStudentDetailsUseCase(kit.access, kit.studentViews);
      await expect(
        useCase.execute({
          actor: actorOf(50, Role.STUDENT),
          studentId: student.id as number,
        }),
      ).resolves.toMatchObject({
        id: student.id,
      });
      await expect(
        useCase.execute({
          actor: actorOf(51, Role.STUDENT),
          studentId: student.id as number,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('UpdateStudentUseCase', () => {
    const update = (kit: StudentsKit) =>
      new UpdateStudentUseCase(kit.students, kit.settings, kit.clock, kit.placement, kit.studentViews);

    it('updates data and classroom', async () => {
      const student = await kit.addStudent({}, { classroomId: null });
      const view = await update(kit).execute({
        studentId: student.id as number,
        details: studentDetails({ documentNumber: 'NEW', eps: 'Sura' }),
        classroomId: 10,
      });
      expect(view).toMatchObject({
        documentNumber: 'NEW',
        eps: 'Sura',
        placement: { classroomId: 10 },
      });
    });

    it('keeps the classroom when omitted and removes it with null', async () => {
      const student = await kit.addStudent();
      const id = student.id as number;
      await update(kit).execute({
        studentId: id,
        details: studentDetails({ documentNumber: 'X' }),
      });
      expect(student.classroomId).toBe(10);
      await update(kit).execute({
        studentId: id,
        details: studentDetails({ documentNumber: 'X' }),
        classroomId: null,
      });
      expect(student.classroomId).toBeNull();
    });

    it('rejects documents of another student, past-year classrooms and unknown students', async () => {
      await kit.addStudent({ documentNumber: 'TAKEN' });
      const student = await kit.addStudent();
      const id = student.id as number;
      await expect(
        update(kit).execute({
          studentId: id,
          details: studentDetails({ documentNumber: 'TAKEN' }),
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      await expect(
        update(kit).execute({
          studentId: id,
          details: studentDetails({ documentNumber: 'Y' }),
          classroomId: CLASSROOM_2025.id,
        }),
      ).rejects.toMatchObject({ code: 'CLASSROOM_NOT_IN_ACADEMIC_YEAR' });
      await expect(update(kit).execute({ studentId: 99, details: studentDetails() })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('ChangeStudentStatusUseCase', () => {
    it('changes the status and publishes the event', async () => {
      const student = await kit.addStudent();
      const useCase = new ChangeStudentStatusUseCase(kit.students, kit.events, kit.clock, kit.studentViews);
      const view = await useCase.execute({
        studentId: student.id as number,
        status: 'withdrawn',
        reason: ' Traslado ',
      });
      expect(view.status).toBe('withdrawn');
      expect(kit.events.published).toEqual([
        expect.objectContaining({
          name: STUDENT_STATUS_CHANGED,
          payload: {
            studentId: student.id,
            code: student.code.toString(),
            previousStatus: 'active',
            status: 'withdrawn',
            reason: 'Traslado',
          },
        }),
      ]);
      await expect(useCase.execute({ studentId: 77, status: 'active' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('photos', () => {
    it('stores a validated photo with a server-side name and replaces the previous one', async () => {
      const student = await kit.addStudent();
      const upload = new UploadStudentPhotoUseCase(kit.students, kit.storage, kit.clock);
      await upload.execute({
        studentId: student.id as number,
        originalName: 'yo.jpg',
        mimeType: 'image/jpeg',
        content: JPEG,
      });
      const first = student.photo as string;
      expect(first).toMatch(/^students\/student_\d+_\d+\.jpg$/);

      kit.clock.advance(1000);
      await upload.execute({
        studentId: student.id as number,
        originalName: 'yo2.jpeg',
        mimeType: 'image/jpeg',
        content: JPEG,
      });
      expect(student.photo).not.toBe(first);
      expect(kit.storage.files.has(first)).toBe(false);
    });

    it('rejects disguised files and unknown students', async () => {
      const student = await kit.addStudent();
      const upload = new UploadStudentPhotoUseCase(kit.students, kit.storage, kit.clock);
      await expect(
        upload.execute({
          studentId: student.id as number,
          originalName: 'x.php',
          mimeType: 'image/jpeg',
          content: JPEG,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PHOTO_TYPE' });
      expect(kit.storage.files.size).toBe(0);
      await expect(
        upload.execute({
          studentId: 9,
          originalName: 'a.jpg',
          mimeType: 'image/jpeg',
          content: JPEG,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('serves the photo only to staff or owners', async () => {
      const student = await kit.addStudent();
      const getPhoto = new GetStudentPhotoUseCase(kit.access, kit.storage);
      const id = student.id as number;
      await expect(getPhoto.execute({ actor: actorOf(1, Role.ADMIN), studentId: id })).rejects.toBeInstanceOf(
        NotFoundError,
      );

      await new UploadStudentPhotoUseCase(kit.students, kit.storage, kit.clock).execute({
        studentId: id,
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        content: JPEG,
      });
      await expect(getPhoto.execute({ actor: actorOf(1, Role.HR), studentId: id })).resolves.toEqual({
        content: JPEG,
        mimeType: 'image/jpeg',
      });
      await expect(getPhoto.execute({ actor: actorOf(2, Role.PARENT), studentId: id })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  describe('LinkStudentGuardianUseCase', () => {
    it('links and unlinks guardians', async () => {
      const student = await kit.addStudent();
      const guardian = await kit.addGuardian();
      const useCase = new LinkStudentGuardianUseCase(kit.students, kit.guardians, kit.studentViews);
      const linked = await useCase.execute({
        studentId: student.id as number,
        guardianId: guardian.id,
      });
      expect(linked.guardianDetails?.id).toBe(guardian.id);
      const unlinked = await useCase.execute({
        studentId: student.id as number,
        guardianId: null,
      });
      expect(unlinked.guardianDetails).toBeNull();
      await expect(useCase.execute({ studentId: student.id as number, guardianId: 404 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(useCase.execute({ studentId: 404, guardianId: null })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
