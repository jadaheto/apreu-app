import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';
import { toThirdPartyView, type ThirdPartyView } from './third-party-view.js';

export interface ListThirdPartiesInput {
  search?: string;
  isActive?: boolean;
  page: PageRequest;
}

/** Searches third parties by name or document, paginated (legacy limit of 200 rows removed). */
@Injectable()
export class ListThirdPartiesUseCase implements UseCase<ListThirdPartiesInput, Paginated<ThirdPartyView>> {
  constructor(@Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository) {}

  async execute({ search, isActive, page }: ListThirdPartiesInput): Promise<Paginated<ThirdPartyView>> {
    return mapPage(await this.thirdParties.search({ search, isActive }, page), toThirdPartyView);
  }
}
