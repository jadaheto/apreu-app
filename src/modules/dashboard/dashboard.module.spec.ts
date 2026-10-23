import { Test } from '@nestjs/testing';
import { GetAdminDashboardUseCase } from './application/get-admin-dashboard.use-case.js';
import { DashboardModule } from './dashboard.module.js';
import { DashboardController } from './infrastructure/http/dashboard.controller.js';
import { KernelStubModule } from '../../shared/testing/kernel-stub.module.js';

describe('DashboardModule', () => {
  it('resolves its controller and use case', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [KernelStubModule, DashboardModule] }).compile();
    expect(moduleRef.get(GetAdminDashboardUseCase)).toBeInstanceOf(GetAdminDashboardUseCase);
    expect(moduleRef.get(DashboardController)).toBeInstanceOf(DashboardController);
  });
});
