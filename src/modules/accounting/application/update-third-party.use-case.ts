import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { IdentityDocument } from '../domain/identity-document.js';
import type { ThirdPartyDetails } from '../domain/third-party.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';
import { toThirdPartyView, type ThirdPartyView } from './third-party-view.js';

export interface UpdateThirdPartyInput extends ThirdPartyDetails {
  id: number;
}

/** Edits a third party (missing in the legacy) keeping the document number unique. */
@Injectable()
export class UpdateThirdPartyUseCase implements UseCase<UpdateThirdPartyInput, ThirdPartyView> {
  constructor(@Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository) {}

  async execute({ id, ...details }: UpdateThirdPartyInput): Promise<ThirdPartyView> {
    const party = await this.thirdParties.findById(id);
    if (!party) throw new NotFoundError('Tercero', id);
    const document = IdentityDocument.create(details.documentType, details.documentNumber, details.dv);
    const homonym = await this.thirdParties.findByDocumentNumber(document.number);
    if (homonym && homonym.id !== id) {
      throw new ConflictError(`Ya existe un tercero con el documento ${document.number}.`);
    }
    party.update(details);
    await this.thirdParties.save(party);
    return toThirdPartyView(party);
  }
}
