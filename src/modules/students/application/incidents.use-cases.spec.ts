import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { actorOf, createStudentsKit, type StudentsKit } from '../testing/students-test-kit.js';
import { CreateIncidentUseCase } from './create-incident.use-case.js';
import { GetIncidentKpisUseCase } from './get-incident-kpis.use-case.js';
import { GetIncidentUseCase } from './get-incident.use-case.js';
import { ListIncidentsUseCase } from './list-incidents.use-case.js';
import { ListStudentIncidentsUseCase } from './list-student-incidents.use-case.js';
import { ReportStudentIncidentUseCase } from './report-student-incident.use-case.js';
import { ReviewIncidentUseCase } from './review-incident.use-case.js';

describe('incident use cases', () => {
  let kit: StudentsKit;
  let create: CreateIncidentUseCase;
  const hr = actorOf(2, Role.HR);

  beforeEach(() => {
    kit = createStudentsKit();
    kit.users.add('hr@c.co', Role.ADMIN, 'Director');
    kit.users.add('rrhh@c.co', Role.HR, 'Talento Humano');
    create = new CreateIncidentUseCase(kit.incidents, kit.students, kit.clock, kit.incidentViews);
  });

  it('creates a pending incident by staff with names resolved', async () => {
    const student = await kit.addStudent();
    const view = await create.execute({
      actor: hr,
      type: 'baja_estudiante',
      priority: 'high',
      title: 'Solicitud de baja',
      studentId: student.id,
    });
    expect(view).toMatchObject({
      status: 'pending',
      type: 'baja_estudiante',
      priority: 'high',
      requestedBy: 2,
      requestedByName: 'Talento Humano',
      studentName: 'Sofía Gómez',
      createdAt: kit.clock.now(),
    });
  });

  it('validates the student and the catalogs', async () => {
    await expect(create.execute({ actor: hr, title: 'X', studentId: 404 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(create.execute({ actor: hr, title: 'X', type: 'general' as never })).rejects.toMatchObject({
      code: 'INVALID_OPTION',
    });
  });

  it('lists with filters, counts every status and gets one incident', async () => {
    const first = await create.execute({
      actor: hr,
      title: 'A',
      type: 'incapacidad',
    });
    await create.execute({ actor: hr, title: 'B', type: 'cierre_caja' });
    const review = new ReviewIncidentUseCase(kit.incidents, kit.clock, kit.incidentViews);
    await review.execute({
      actor: actorOf(1, Role.ADMIN),
      incidentId: first.id,
      action: 'approved',
      notes: 'Ok',
    });
    await review.execute({
      actor: actorOf(1, Role.ADMIN),
      incidentId: first.id,
      action: 'closed',
    });

    const list = await new ListIncidentsUseCase(kit.incidents, kit.incidentViews).execute({
      criteria: { status: 'pending' },
      page: { page: 1, limit: 10 },
    });
    expect(list.items.map((i) => i.title)).toEqual(['B']);

    await expect(new GetIncidentKpisUseCase(kit.incidents).execute()).resolves.toEqual({
      pending: 1,
      in_review: 0,
      approved: 0,
      rejected: 0,
      closed: 1,
    });
    await expect(new GetIncidentUseCase(kit.incidents, kit.incidentViews).execute(first.id)).resolves.toMatchObject({
      status: 'closed',
      reviewedByName: 'Director',
    });
    await expect(new GetIncidentUseCase(kit.incidents, kit.incidentViews).execute(404)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('enforces the review state machine (S7)', async () => {
    const incident = await create.execute({ actor: hr, title: 'A' });
    const review = new ReviewIncidentUseCase(kit.incidents, kit.clock, kit.incidentViews);
    await expect(review.execute({ actor: hr, incidentId: incident.id, action: 'closed' })).rejects.toMatchObject({
      code: 'INVALID_INCIDENT_TRANSITION',
    });
    await expect(
      review.execute({
        actor: hr,
        incidentId: incident.id,
        action: 'in_review',
        notes: 'Revisando',
      }),
    ).resolves.toMatchObject({
      status: 'in_review',
      reviewNotes: 'Revisando',
      reviewedBy: 2,
    });
    await expect(review.execute({ actor: hr, incidentId: 404, action: 'approved' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe('portal', () => {
    it('lets a guardian report and list incidents of their child only (S3, S8)', async () => {
      const guardian = await kit.addGuardian();
      guardian.linkUser(80);
      const child = await kit.addStudent({}, { guardianId: guardian.id });
      const stranger = await kit.addStudent();
      const parent = actorOf(80, Role.PARENT);
      const report = new ReportStudentIncidentUseCase(kit.access, kit.incidents, kit.clock);
      const list = new ListStudentIncidentsUseCase(kit.access, kit.incidents);

      await expect(
        report.execute({
          actor: parent,
          studentId: child.id as number,
          type: 'incapacidad',
          title: 'Fiebre',
        }),
      ).resolves.toMatchObject({
        status: 'pending',
        type: 'incapacidad',
        requestedBy: 80,
        studentId: child.id,
      });
      await create.execute({
        actor: hr,
        title: 'Otra',
        studentId: stranger.id,
      });

      const page = await list.execute({
        actor: parent,
        studentId: child.id as number,
        page: { page: 1, limit: 50 },
      });
      expect(page.items.map((i) => i.title)).toEqual(['Fiebre']);
      await expect(
        list.execute({
          actor: parent,
          studentId: stranger.id as number,
          page: { page: 1, limit: 50 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        report.execute({
          actor: parent,
          studentId: stranger.id as number,
          title: 'X',
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('rejects staff-only types and staff actors on the portal use case', async () => {
      const student = await kit.addStudent();
      student.linkUser(81);
      const report = new ReportStudentIncidentUseCase(kit.access, kit.incidents, kit.clock);
      await expect(
        report.execute({
          actor: actorOf(81, Role.STUDENT),
          studentId: student.id as number,
          type: 'cierre_caja',
          title: 'X',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_OPTION' });
      await expect(
        report.execute({
          actor: actorOf(1, Role.ADMIN),
          studentId: student.id as number,
          title: 'X',
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
