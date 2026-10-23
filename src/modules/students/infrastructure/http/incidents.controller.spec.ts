import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { CreateIncidentUseCase } from '../../application/create-incident.use-case.js';
import { GetIncidentKpisUseCase } from '../../application/get-incident-kpis.use-case.js';
import { GetIncidentUseCase } from '../../application/get-incident.use-case.js';
import { ListIncidentsUseCase } from '../../application/list-incidents.use-case.js';
import { ReviewIncidentUseCase } from '../../application/review-incident.use-case.js';
import { actorOf } from '../../testing/students-test-kit.js';
import { ListIncidentsQueryDto } from './dto/incident.dto.js';
import { IncidentsController } from './incidents.controller.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue({}) });

describe('IncidentsController', () => {
  const list = mock();
  const kpis = mock();
  const get = mock();
  const create = mock();
  const review = mock();
  const actor = actorOf(2, Role.HR);
  let controller: IncidentsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [
        { provide: ListIncidentsUseCase, useValue: list },
        { provide: GetIncidentKpisUseCase, useValue: kpis },
        { provide: GetIncidentUseCase, useValue: get },
        { provide: CreateIncidentUseCase, useValue: create },
        { provide: ReviewIncidentUseCase, useValue: review },
      ],
    }).compile();
    controller = moduleRef.get(IncidentsController);
  });

  it('lists, counts and gets incidents', async () => {
    await controller.list(
      Object.assign(new ListIncidentsQueryDto(), {
        status: 'pending',
        type: 'otra',
        studentId: 3,
      }),
    );
    expect(list.execute).toHaveBeenCalledWith({
      criteria: { status: 'pending', type: 'otra', studentId: 3 },
      page: { page: 1, limit: 20 },
    });
    await controller.kpis();
    expect(kpis.execute).toHaveBeenCalled();
    await controller.get(5);
    expect(get.execute).toHaveBeenCalledWith(5);
  });

  it('creates and reviews with the current actor', async () => {
    await controller.create(actor, {
      title: 'T',
      type: 'incapacidad',
      studentId: 3,
    });
    expect(create.execute).toHaveBeenCalledWith({
      actor,
      title: 'T',
      type: 'incapacidad',
      studentId: 3,
    });
    await controller.review(actor, 5, { action: 'approved', notes: 'Ok' });
    expect(review.execute).toHaveBeenCalledWith({
      actor,
      incidentId: 5,
      action: 'approved',
      notes: 'Ok',
    });
  });
});
