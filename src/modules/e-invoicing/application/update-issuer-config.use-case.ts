import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { IssuerConfigUpdate } from '../domain/issuer-config.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import { toIssuerConfigView, type IssuerConfigView } from './issuer-config-view.js';
import { daneLocation } from './services/document-inputs.js';

export type UpdateIssuerConfigInput = Omit<IssuerConfigUpdate, 'location'> & { cityCode?: string };

/**
 * Updates the issuer data, DIAN software and behaviour flags. The DANE names
 * are resolved from the municipality code; the software PIN is write-only
 * (omitting it keeps the stored one).
 */
@Injectable()
export class UpdateIssuerConfigUseCase implements UseCase<UpdateIssuerConfigInput, IssuerConfigView> {
  constructor(@Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository) {}

  async execute({ cityCode, ...changes }: UpdateIssuerConfigInput): Promise<IssuerConfigView> {
    const config = await this.configs.get();
    config.update({ ...changes, ...(cityCode ? { location: daneLocation(cityCode) } : {}) });
    await this.configs.save(config);
    return toIssuerConfigView(config);
  }
}
