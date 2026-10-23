import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import type { DocumentType } from '../domain/catalogs.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import { toResolutionView, type ResolutionView } from './resolution-view.js';

/**
 * Restarts the habilitation numbering of the given types (legacy
 * `reset_consecutives.php`). Only in habilitation; no document is deleted —
 * each reset opens a new numbering cycle so stored numbers remain unique.
 */
@Injectable()
export class ResetHabilitationNumberingUseCase implements UseCase<DocumentType[], ResolutionView[]> {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(types: DocumentType[]): Promise<ResolutionView[]> {
    if ((await this.configs.get()).environment !== '2') {
      throw new BusinessRuleViolationError(
        'Solo se puede reiniciar la numeración en ambiente de habilitación.',
        'RESET_NOT_ALLOWED',
      );
    }
    return this.unitOfWork.runInTransaction(async () => {
      const reset: ResolutionView[] = [];
      for (const type of new Set(types)) {
        const resolution = await this.resolutions.lockActive(type);
        if (!resolution) continue;
        resolution.resetForHabilitation();
        await this.resolutions.save(resolution);
        reset.push(toResolutionView(resolution));
      }
      return reset;
    });
  }
}
