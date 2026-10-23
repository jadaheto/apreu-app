import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetPortalDashboardUseCase } from '../../application/get-portal-dashboard.use-case.js';
import { GetStudentDetailsUseCase } from '../../application/get-student-details.use-case.js';
import { ListStudentIncidentsUseCase } from '../../application/list-student-incidents.use-case.js';
import { ReportStudentIncidentUseCase } from '../../application/report-student-incident.use-case.js';
import { ResolvePortalContextUseCase } from '../../application/resolve-portal-context.use-case.js';
import { actorOf } from '../../testing/students-test-kit.js';
import { PortalController } from './portal.controller.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue({}) });

describe('PortalController', () => {
  const context = mock();
  const dashboard = mock();
  const details = mock();
  const incidents = mock();
  const report = mock();
  const actor = actorOf(8, Role.PARENT);
  let controller: PortalController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        { provide: ResolvePortalContextUseCase, useValue: context },
        { provide: GetPortalDashboardUseCase, useValue: dashboard },
        { provide: GetStudentDetailsUseCase, useValue: details },
        { provide: ListStudentIncidentsUseCase, useValue: incidents },
        { provide: ReportStudentIncidentUseCase, useValue: report },
      ],
    }).compile();
    controller = moduleRef.get(PortalController);
  });

  it('always passes the actor and the explicit student', async () => {
    await controller.context(actor);
    expect(context.execute).toHaveBeenCalledWith(actor);
    await controller.home(actor, 3);
    expect(dashboard.execute).toHaveBeenCalledWith({ actor, studentId: 3 });
    await controller.profile(actor, 3);
    expect(details.execute).toHaveBeenCalledWith({ actor, studentId: 3 });
    await controller.incidents(actor, 3, Object.assign(new PaginationQueryDto(), { page: 2, limit: 10 }));
    expect(incidents.execute).toHaveBeenCalledWith({
      actor,
      studentId: 3,
      page: { page: 2, limit: 10 },
    });
    await controller.report(actor, 3, { title: 'Fiebre', type: 'incapacidad' });
    expect(report.execute).toHaveBeenCalledWith({
      actor,
      studentId: 3,
      title: 'Fiebre',
      type: 'incapacidad',
    });
  });

  it('is limited to students and guardians', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PortalController)).toEqual([Role.STUDENT, Role.PARENT]);
  });
});
