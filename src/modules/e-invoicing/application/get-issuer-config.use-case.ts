import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import { toIssuerConfigView, type IssuerConfigView } from './issuer-config-view.js';

/** Returns the issuer configuration without secrets (legacy `settings.php`, pestaña DIAN). */
@Injectable()
export class GetIssuerConfigUseCase implements UseCase<void, IssuerConfigView> {
  constructor(@Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository) {}

  async execute(): Promise<IssuerConfigView> {
    return toIssuerConfigView(await this.configs.get());
  }
}
