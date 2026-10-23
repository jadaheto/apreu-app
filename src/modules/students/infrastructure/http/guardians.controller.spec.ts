import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateGuardianUseCase } from '../../application/create-guardian.use-case.js';
import { FindGuardianByDocumentUseCase } from '../../application/find-guardian-by-document.use-case.js';
import { GetGuardianUseCase } from '../../application/get-guardian.use-case.js';
import { UpdateGuardianUseCase } from '../../application/update-guardian.use-case.js';
import { GuardiansController } from './guardians.controller.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue({}) });

describe('GuardiansController', () => {
  const find = mock();
  const get = mock();
  const create = mock();
  const update = mock();
  const dto = { documentNumber: '1', firstName: 'M', lastName: 'R' };
  let controller: GuardiansController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GuardiansController],
      providers: [
        { provide: FindGuardianByDocumentUseCase, useValue: find },
        { provide: GetGuardianUseCase, useValue: get },
        { provide: CreateGuardianUseCase, useValue: create },
        { provide: UpdateGuardianUseCase, useValue: update },
      ],
    }).compile();
    controller = moduleRef.get(GuardiansController);
  });

  it('delegates to the guardian use cases', async () => {
    await controller.find({ documentNumber: '52' });
    expect(find.execute).toHaveBeenCalledWith('52');
    await controller.get(4);
    expect(get.execute).toHaveBeenCalledWith(4);
    await controller.create(dto);
    expect(create.execute).toHaveBeenCalledWith(dto);
    await controller.update(4, dto);
    expect(update.execute).toHaveBeenCalledWith({
      guardianId: 4,
      details: dto,
    });
  });

  it('is restricted to admin', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GuardiansController)).toEqual([Role.ADMIN]);
  });
});
