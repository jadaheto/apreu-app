import { Test } from '@nestjs/testing';
import { UpdateSettingsSectionUseCase } from './application/update-settings-section.use-case.js';
import { UploadInstitutionLogoUseCase } from './application/upload-institution-logo.use-case.js';
import { InstitutionController } from './infrastructure/http/institution.controller.js';
import { SettingsController } from './infrastructure/http/settings.controller.js';
import { InstitutionModule } from './institution.module.js';
import { KernelStubModule } from '../../shared/testing/kernel-stub.module.js';

describe('InstitutionModule', () => {
  it('resolves every controller and use case', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [KernelStubModule, InstitutionModule] }).compile();
    [UploadInstitutionLogoUseCase, UpdateSettingsSectionUseCase, InstitutionController, SettingsController].forEach(
      (type) => expect(moduleRef.get(type)).toBeInstanceOf(type),
    );
  });
});
