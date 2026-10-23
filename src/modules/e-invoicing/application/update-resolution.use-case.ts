import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { ResolutionChanges } from '../domain/numbering-resolution.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import { toResolutionView, type ResolutionView } from './resolution-view.js';

export interface UpdateResolutionInput extends ResolutionChanges {
  id: number;
}

/** Extends, renews, rotates the technical key or (de)activates a numbering range. Activating one deactivates the others of its type. */
@Injectable()
export class UpdateResolutionUseCase implements UseCase<UpdateResolutionInput, ResolutionView> {
  constructor(
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute({ id, ...changes }: UpdateResolutionInput): Promise<ResolutionView> {
    return this.unitOfWork.runInTransaction(async () => {
      const resolution = await this.resolutions.findById(id);
      if (!resolution) throw new NotFoundError('Resolución de numeración', id);
      if (changes.active && !resolution.isActive) {
        const current = await this.resolutions.findActive(resolution.docType);
        if (current) {
          current.deactivate();
          await this.resolutions.save(current);
        }
      }
      resolution.change(changes);
      await this.resolutions.save(resolution);
      return toResolutionView(resolution);
    });
  }
}
