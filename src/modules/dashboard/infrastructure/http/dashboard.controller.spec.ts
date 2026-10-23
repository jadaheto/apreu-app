import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetAdminDashboardUseCase } from '../../application/get-admin-dashboard.use-case.js';
import { DashboardController } from './dashboard.controller.js';

describe('DashboardController', () => {
  const adminDashboard = { execute: vi.fn().mockResolvedValue({ today: '2026-03-15' }) };
  let controller: DashboardController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: GetAdminDashboardUseCase, useValue: adminDashboard }],
    }).compile();
    controller = moduleRef.get(DashboardController);
  });

  it('is available to admin, finance and hr (plus superadmin)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, DashboardController.prototype.admin)).toEqual([
      Role.ADMIN,
      Role.FINANCE,
      Role.HR,
    ]);
  });

  it('builds the dashboard for the actor role', async () => {
    const actor = { userId: 1, role: Role.HR, email: 'h@c.co', name: 'H', tenant: 't' };
    await expect(controller.admin(actor)).resolves.toEqual({ today: '2026-03-15' });
    expect(adminDashboard.execute).toHaveBeenCalledWith(Role.HR);
  });
});
