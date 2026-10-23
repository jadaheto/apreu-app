import { Inject, Injectable, Logger } from '@nestjs/common';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { validateImageUpload, type ImageUploadInput } from '../domain/image-upload.js';
import {
  INSTITUTION_PROFILE_REPOSITORY,
  type InstitutionProfileRepository,
} from '../domain/institution-profile.repository.js';
import { toInstitutionProfileView, type InstitutionProfileView } from './institution-profile-view.js';
import { ASSET_STORAGE, type AssetStoragePort } from './ports/asset-storage.port.js';

/**
 * Replaces the school logo (legacy `settings.php` tab "Visual"). The image is
 * validated strictly ({@link validateImageUpload}), stored under a generated
 * name whose extension comes from the detected format, and the previous file
 * is removed once the new one is committed.
 */
@Injectable()
export class UploadInstitutionLogoUseCase implements UseCase<ImageUploadInput, InstitutionProfileView> {
  private readonly logger = new Logger(UploadInstitutionLogoUseCase.name);

  constructor(
    @Inject(INSTITUTION_PROFILE_REPOSITORY) private readonly profiles: InstitutionProfileRepository,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStoragePort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: ImageUploadInput): Promise<InstitutionProfileView> {
    const image = validateImageUpload(input);
    const key = `institution/logo-${this.clock.now().getTime()}.${image.extension}`;
    await this.storage.save(key, input.content);

    try {
      const { profile, previous } = await this.unitOfWork.runInTransaction(async () => {
        const current = await this.profiles.find();
        if (!current) {
          throw new BusinessRuleViolationError(
            'Registre primero los datos de la institución antes de subir el logo.',
            'INSTITUTION_NOT_CONFIGURED',
          );
        }
        const replaced = current.logoPath;
        current.changeLogo(key);
        await this.profiles.save(current);
        return { profile: current, previous: replaced };
      });
      if (previous && previous !== key) await this.removeQuietly(previous);
      return toInstitutionProfileView(profile);
    } catch (error) {
      await this.removeQuietly(key);
      throw error;
    }
  }

  private async removeQuietly(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(`No se pudo eliminar el archivo ${key}: ${(error as Error).message}`);
    }
  }
}
