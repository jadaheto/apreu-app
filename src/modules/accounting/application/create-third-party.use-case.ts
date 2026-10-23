import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError } from '../../../shared/domain/domain-error.js';
import { ThirdParty, type ThirdPartyDetails } from '../domain/third-party.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';
import { toThirdPartyView, type ThirdPartyView } from './third-party-view.js';

/**
 * Registers a third party (legacy `third_parties.php` `action=create`).
 * The document number is unique (RN-TP-01): a duplicate yields a 409 instead
 * of the raw SQL error of the legacy (bug 21). NIT check digits are computed
 * and validated (RN-TP-02).
 */
@Injectable()
export class CreateThirdPartyUseCase implements UseCase<ThirdPartyDetails, ThirdPartyView> {
  constructor(@Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository) {}

  async execute(details: ThirdPartyDetails): Promise<ThirdPartyView> {
    const party = ThirdParty.create(details);
    if (await this.thirdParties.findByDocumentNumber(party.document.number)) {
      throw new ConflictError(`Ya existe un tercero con el documento ${party.document.number}.`);
    }
    await this.thirdParties.save(party);
    return toThirdPartyView(party);
  }
}
