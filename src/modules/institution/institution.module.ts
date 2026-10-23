import { Module } from '@nestjs/common';
import { GetInstitutionLogoUseCase } from './application/get-institution-logo.use-case.js';
import { GetInstitutionProfileUseCase } from './application/get-institution-profile.use-case.js';
import { GetPublicBrandingUseCase } from './application/get-public-branding.use-case.js';
import { GetSettingsCatalogUseCase } from './application/get-settings-catalog.use-case.js';
import { GetSettingsSectionUseCase } from './application/get-settings-section.use-case.js';
import { ASSET_STORAGE } from './application/ports/asset-storage.port.js';
import { UpdateInstitutionProfileUseCase } from './application/update-institution-profile.use-case.js';
import { UpdateSettingsSectionUseCase } from './application/update-settings-section.use-case.js';
import { UploadInstitutionLogoUseCase } from './application/upload-institution-logo.use-case.js';
import { INSTITUTION_PROFILE_REPOSITORY } from './domain/institution-profile.repository.js';
import { SETTINGS_REPOSITORY } from './domain/settings/settings.repository.js';
import { LocalAssetStorage } from './infrastructure/adapters/local-asset-storage.js';
import { InstitutionController } from './infrastructure/http/institution.controller.js';
import { SettingsController } from './infrastructure/http/settings.controller.js';
import { TypeOrmInstitutionProfileRepository, TypeOrmSettingsRepository } from './infrastructure/persistence/index.js';

/**
 * Institution context: school profile (`institutions`), typed configuration
 * (`settings`), logo and public branding. Composition root.
 */
@Module({
  controllers: [InstitutionController, SettingsController],
  providers: [
    GetInstitutionProfileUseCase,
    UpdateInstitutionProfileUseCase,
    UploadInstitutionLogoUseCase,
    GetInstitutionLogoUseCase,
    GetPublicBrandingUseCase,
    GetSettingsCatalogUseCase,
    GetSettingsSectionUseCase,
    UpdateSettingsSectionUseCase,
    TypeOrmSettingsRepository,
    { provide: SETTINGS_REPOSITORY, useExisting: TypeOrmSettingsRepository },
    { provide: INSTITUTION_PROFILE_REPOSITORY, useClass: TypeOrmInstitutionProfileRepository },
    { provide: ASSET_STORAGE, useClass: LocalAssetStorage },
  ],
})
export class InstitutionModule {}
