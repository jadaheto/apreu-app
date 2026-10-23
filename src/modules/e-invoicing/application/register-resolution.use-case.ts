import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError } from '../../../shared/domain/domain-error.js';
import { NumberingResolution, type RegisterResolutionInput } from '../domain/numbering-resolution.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import { toResolutionView, type ResolutionView } from './resolution-view.js';

/**
 * Registers a numbering range and makes it the active one of its type
 * (the previous active range of the type is deactivated).
 *
 * A prefix belongs to a single document type: credit and debit notes cannot
 * reuse the invoice prefix (legacy bug: repeated numbers across types).
 */
@Injectable()
export class RegisterResolutionUseCase implements UseCase<RegisterResolutionInput, ResolutionView> {
  constructor(
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: RegisterResolutionInput): Promise<ResolutionView> {
    const resolution = NumberingResolution.register(input);
    return this.unitOfWork.runInTransaction(async () => {
      const samePrefix = await this.resolutions.findByPrefix(resolution.prefix);
      if (samePrefix.some((existing) => existing.docType !== resolution.docType)) {
        throw new ConflictError(`El prefijo ${resolution.prefix} ya se usa en otro tipo de documento.`);
      }
      if (samePrefix.length) {
        throw new ConflictError(
          `Ya existe una numeración con el prefijo ${resolution.prefix}; actualícela en lugar de crear otra.`,
        );
      }
      const previous = await this.resolutions.findActive(resolution.docType);
      if (previous) {
        previous.deactivate();
        await this.resolutions.save(previous);
      }
      await this.resolutions.save(resolution);
      return toResolutionView(resolution);
    });
  }
}
