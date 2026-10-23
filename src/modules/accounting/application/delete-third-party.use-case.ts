import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';

/** Deletes a third party without movements (RN-TP-03); otherwise it must be deactivated. */
@Injectable()
export class DeleteThirdPartyUseCase implements UseCase<number, void> {
  constructor(@Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository) {}

  async execute(id: number): Promise<void> {
    if (!(await this.thirdParties.findById(id))) throw new NotFoundError('Tercero', id);
    if (await this.thirdParties.hasMovements(id)) {
      throw new ConflictError('No se puede eliminar: el tercero tiene movimientos contables. Puede inactivarlo.');
    }
    await this.thirdParties.delete(id);
  }
}
