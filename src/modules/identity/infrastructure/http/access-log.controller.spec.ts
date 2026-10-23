import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ListAccessLogUseCase } from '../../application/list-access-log.use-case.js';
import { AccessLogController } from './access-log.controller.js';
import { AccessLogQueryDto } from './dto/access-log.dto.js';

describe('AccessLogController', () => {
  const listAccessLog = { execute: vi.fn().mockResolvedValue({ items: [] }) };
  let controller: AccessLogController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccessLogController],
      providers: [{ provide: ListAccessLogUseCase, useValue: listAccessLog }],
    }).compile();
    controller = moduleRef.get(AccessLogController);
  });

  it('is restricted to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AccessLogController)).toEqual([Role.ADMIN]);
  });

  it('maps the query string to criteria and paging', async () => {
    const query = Object.assign(new AccessLogQueryDto(), {
      userId: 3,
      module: 'auth',
      allowed: false,
      from: '2026-01-01',
      to: '2026-01-31',
      search: 'login',
    });
    await controller.list(query);
    expect(listAccessLog.execute).toHaveBeenCalledWith({
      criteria: { userId: 3, module: 'auth', allowed: false, from: '2026-01-01', to: '2026-01-31', search: 'login' },
      page: { page: 1, limit: 20 },
    });
  });
});
