import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';
import { toThirdPartyView, type ThirdPartyView } from './third-party-view.js';

export interface ChangeThirdPartyStatusInput {
  id: number;
  active: boolean;
}

/**
 * Activates or deactivates a third party (`is_active`, unused by the legacy).
 * Inactive third parties keep their history but cannot receive new lines.
 */
@Injectable()
export class ChangeThirdPartyStatusUseCase implements UseCase<ChangeThirdPartyStatusInput, ThirdPartyView> {
  constructor(@Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository) {}

  async execute({ id, active }: ChangeThirdPartyStatusInput): Promise<ThirdPartyView> {
    const party = await this.thirdParties.findById(id);
    if (!party) throw new NotFoundError('Tercero', id);
    if (active) party.activate();
    else party.deactivate();
    await this.thirdParties.save(party);
    return toThirdPartyView(party);
  }
}
