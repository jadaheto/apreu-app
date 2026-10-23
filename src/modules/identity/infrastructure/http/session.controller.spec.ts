import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetMyPermissionsUseCase } from '../../application/get-my-permissions.use-case.js';
import { LogoutUseCase } from '../../application/logout.use-case.js';
import { RefreshSessionUseCase } from '../../application/refresh-session.use-case.js';
import { SessionController } from './session.controller.js';

describe('SessionController', () => {
  const permissions = { execute: vi.fn().mockResolvedValue({ modules: [] }) };
  const refresh = { execute: vi.fn().mockResolvedValue({ accessToken: 't' }) };
  const logout = { execute: vi.fn().mockResolvedValue(undefined) };
  const actor = { userId: 4, role: Role.HR, email: 'h@c.co', name: 'H', tenant: 'colegio-a' };
  let controller: SessionController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        { provide: GetMyPermissionsUseCase, useValue: permissions },
        { provide: RefreshSessionUseCase, useValue: refresh },
        { provide: LogoutUseCase, useValue: logout },
      ],
    }).compile();
    controller = moduleRef.get(SessionController);
  });

  it('is open to every authenticated role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SessionController)).toBeUndefined();
  });

  it('returns the permissions of the actor role', async () => {
    await expect(controller.permissions(actor)).resolves.toEqual({ modules: [] });
    expect(permissions.execute).toHaveBeenCalledWith(Role.HR);
  });

  it('refreshes the session within the token tenant', async () => {
    await controller.refresh(actor);
    expect(refresh.execute).toHaveBeenCalledWith({ userId: 4, tenant: 'colegio-a' });
  });

  it('audits the logout with the client ip', async () => {
    await controller.signOut(actor, '8.8.8.8');
    expect(logout.execute).toHaveBeenCalledWith({ actor, ipAddress: '8.8.8.8' });
  });
});
