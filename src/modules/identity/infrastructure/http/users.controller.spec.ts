import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ChangeUserStatusUseCase } from '../../application/change-user-status.use-case.js';
import { CreateUserUseCase } from '../../application/create-user.use-case.js';
import { GetUserStatsUseCase } from '../../application/get-user-stats.use-case.js';
import { GetUserUseCase } from '../../application/get-user.use-case.js';
import { ListUsersUseCase } from '../../application/list-users.use-case.js';
import { ResetUserPasswordUseCase } from '../../application/reset-user-password.use-case.js';
import { UpdateUserUseCase } from '../../application/update-user.use-case.js';
import { ListUsersQueryDto } from './dto/user-admin.dto.js';
import { UsersController } from './users.controller.js';

describe('UsersController', () => {
  const useCase = () => ({ execute: vi.fn().mockResolvedValue('ok') });
  const mocks = {
    list: useCase(),
    stats: useCase(),
    get: useCase(),
    create: useCase(),
    update: useCase(),
    status: useCase(),
    reset: useCase(),
  };
  const actor = { userId: 7, role: Role.ADMIN, email: 'a@b.co', name: 'A', tenant: 'colegio-a' };
  const administrator = { userId: 7, role: Role.ADMIN };
  let controller: UsersController;

  beforeEach(async () => {
    Object.values(mocks).forEach((mock) => mock.execute.mockClear());
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: ListUsersUseCase, useValue: mocks.list },
        { provide: GetUserStatsUseCase, useValue: mocks.stats },
        { provide: GetUserUseCase, useValue: mocks.get },
        { provide: CreateUserUseCase, useValue: mocks.create },
        { provide: UpdateUserUseCase, useValue: mocks.update },
        { provide: ChangeUserStatusUseCase, useValue: mocks.status },
        { provide: ResetUserPasswordUseCase, useValue: mocks.reset },
      ],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('is restricted to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([Role.ADMIN]);
  });

  it('lists with filters and paging', async () => {
    const query = Object.assign(new ListUsersQueryDto(), {
      page: 2,
      limit: 5,
      search: 'ana',
      role: Role.TEACHER,
      active: true,
    });
    await controller.list(query);
    expect(mocks.list.execute).toHaveBeenCalledWith({
      search: 'ana',
      role: Role.TEACHER,
      isActive: true,
      page: { page: 2, limit: 5 },
    });
  });

  it('returns stats and details', async () => {
    await controller.stats();
    await controller.detail(3);
    expect(mocks.stats.execute).toHaveBeenCalled();
    expect(mocks.get.execute).toHaveBeenCalledWith(3);
  });

  it('passes the acting administrator to the commands', async () => {
    await controller.create(actor, { name: 'N', email: 'n@c.co', role: Role.HR });
    await controller.update(actor, 3, { role: Role.FINANCE });
    await controller.status(actor, 3, { active: false });
    await controller.reset(actor, 3);
    expect(mocks.create.execute).toHaveBeenCalledWith({
      actor: administrator,
      name: 'N',
      email: 'n@c.co',
      role: Role.HR,
    });
    expect(mocks.update.execute).toHaveBeenCalledWith({ actor: administrator, userId: 3, role: Role.FINANCE });
    expect(mocks.status.execute).toHaveBeenCalledWith({ actor: administrator, userId: 3, active: false });
    expect(mocks.reset.execute).toHaveBeenCalledWith({ actor: administrator, userId: 3 });
  });
});
