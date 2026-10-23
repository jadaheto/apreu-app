import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import { toResolutionView, type ResolutionView } from './resolution-view.js';

/** Lists every numbering range (invoices, credit and debit notes) with its usage. */
@Injectable()
export class ListResolutionsUseCase implements UseCase<void, ResolutionView[]> {
  constructor(@Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository) {}

  async execute(): Promise<ResolutionView[]> {
    return (await this.resolutions.list()).map(toResolutionView);
  }
}
