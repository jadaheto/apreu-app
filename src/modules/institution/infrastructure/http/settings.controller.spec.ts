import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetSettingsCatalogUseCase } from '../../application/get-settings-catalog.use-case.js';
import { GetSettingsSectionUseCase } from '../../application/get-settings-section.use-case.js';
import { UpdateSettingsSectionUseCase } from '../../application/update-settings-section.use-case.js';
import { SettingsController } from './settings.controller.js';

describe('SettingsController', () => {
  const catalog = { execute: vi.fn().mockResolvedValue([]) };
  const getSection = { execute: vi.fn().mockResolvedValue({ section: 'payments' }) };
  const updateSection = { execute: vi.fn().mockResolvedValue({ section: 'payments' }) };
  const actor = { userId: 3, role: Role.FINANCE, email: 'f@c.co', name: 'F', tenant: 'colegio-a' };
  let controller: SettingsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: GetSettingsCatalogUseCase, useValue: catalog },
        { provide: GetSettingsSectionUseCase, useValue: getSection },
        { provide: UpdateSettingsSectionUseCase, useValue: updateSection },
      ],
    }).compile();
    controller = moduleRef.get(SettingsController);
  });

  it('is limited to back-office roles (section access is checked by the use case)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SettingsController)).toEqual([Role.ADMIN, Role.FINANCE, Role.HR]);
  });

  it('delegates with the actor role', async () => {
    await controller.sections(actor);
    await controller.read(actor, 'payments');
    await controller.update(actor, 'payments', { values: { bank_name: 'Banco' } });
    expect(catalog.execute).toHaveBeenCalledWith(Role.FINANCE);
    expect(getSection.execute).toHaveBeenCalledWith({ role: Role.FINANCE, section: 'payments' });
    expect(updateSection.execute).toHaveBeenCalledWith({
      role: Role.FINANCE,
      section: 'payments',
      values: { bank_name: 'Banco' },
    });
  });
});
