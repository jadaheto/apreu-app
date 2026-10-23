import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import { ChangePasswordUseCase } from '../../application/change-password.use-case.js';
import { GetCurrentUserUseCase } from '../../application/get-current-user.use-case.js';
import { LoginUseCase } from '../../application/login.use-case.js';
import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  const login = { execute: vi.fn().mockResolvedValue({ accessToken: 't' }) };
  const currentUser = { execute: vi.fn().mockResolvedValue({ id: 1 }) };
  const changePassword = { execute: vi.fn().mockResolvedValue(undefined) };
  const tenantContext = new TenantContext();
  const actor = { userId: 1, role: Role.ADMIN, email: 'a@b.co', name: 'A', tenant: 'colegio-a' };
  let controller: AuthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: login },
        { provide: GetCurrentUserUseCase, useValue: currentUser },
        { provide: ChangePasswordUseCase, useValue: changePassword },
        { provide: TenantContext, useValue: tenantContext },
      ],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('logs in within the tenant of the request', async () => {
    const tenant = { id: 1, slug: 'colegio-a', name: 'A', status: 'active' as const, databaseName: 'x' };
    await tenantContext.run(tenant, () => controller.signIn({ email: 'a@b.co', password: 'p' }, '9.9.9.9'));
    expect(login.execute).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'p',
      tenant: 'colegio-a',
      ipAddress: '9.9.9.9',
    });
  });

  it('returns the current user', async () => {
    await expect(controller.me(actor)).resolves.toEqual({ id: 1 });
    expect(currentUser.execute).toHaveBeenCalledWith(1);
  });

  it('changes the password of the actor', async () => {
    await controller.updatePassword(actor, { currentPassword: 'a', newPassword: 'b' });
    expect(changePassword.execute).toHaveBeenCalledWith({ userId: 1, currentPassword: 'a', newPassword: 'b' });
  });
});
