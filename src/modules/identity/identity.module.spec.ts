import { Test } from '@nestjs/testing';
import { CreateUserUseCase } from './application/create-user.use-case.js';
import { GetMyPermissionsUseCase } from './application/get-my-permissions.use-case.js';
import { LoginUseCase } from './application/login.use-case.js';
import { IdentityModule } from './identity.module.js';
import { UsersController } from './infrastructure/http/users.controller.js';
import { KernelStubModule } from '../../shared/testing/kernel-stub.module.js';

describe('IdentityModule', () => {
  it('resolves every controller and use case', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [KernelStubModule, IdentityModule] }).compile();
    [LoginUseCase, CreateUserUseCase, GetMyPermissionsUseCase, UsersController].forEach((type) =>
      expect(moduleRef.get(type)).toBeInstanceOf(type),
    );
  });
});
