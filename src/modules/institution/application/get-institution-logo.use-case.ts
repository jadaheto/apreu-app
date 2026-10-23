import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { detectImageFormat, type ImageFormat } from '../domain/image-upload.js';
import {
  INSTITUTION_PROFILE_REPOSITORY,
  type InstitutionProfileRepository,
} from '../domain/institution-profile.repository.js';
import { ASSET_STORAGE, type AssetStoragePort } from './ports/asset-storage.port.js';

export interface InstitutionLogo {
  content: Uint8Array;
  mimeType: ImageFormat['mimeType'];
}

/** Logo bytes with a content type derived from the file itself (legacy only used it "if the file exists"). */
@Injectable()
export class GetInstitutionLogoUseCase implements UseCase<void, InstitutionLogo> {
  constructor(
    @Inject(INSTITUTION_PROFILE_REPOSITORY) private readonly profiles: InstitutionProfileRepository,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStoragePort,
  ) {}

  async execute(): Promise<InstitutionLogo> {
    const path = (await this.profiles.find())?.logoPath;
    const content = path ? await this.storage.read(path) : null;
    const format = content ? detectImageFormat(content) : null;
    if (!content || !format) throw new NotFoundError('Logo de la institución', 'actual');
    return { content, mimeType: format.mimeType };
  }
}
