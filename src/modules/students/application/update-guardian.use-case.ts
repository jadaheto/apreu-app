import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { GuardianDetails } from '../domain/guardian.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { GuardianViewAssembler, type GuardianDetailView } from './guardian-view.assembler.js';

export interface UpdateGuardianInput {
  guardianId: number;
  details: GuardianDetails;
}

/**
 * Edits a guardian. The record is shared by siblings, so the change applies
 * to all of them (made explicit in the response, which lists the students).
 */
@Injectable()
export class UpdateGuardianUseCase implements UseCase<UpdateGuardianInput, GuardianDetailView> {
  constructor(
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    private readonly assembler: GuardianViewAssembler,
  ) {}

  async execute({ guardianId, details }: UpdateGuardianInput): Promise<GuardianDetailView> {
    const guardian = await this.guardians.findById(guardianId);
    if (!guardian) throw new NotFoundError('Acudiente', guardianId);
    guardian.update(details);
    const duplicate = await this.guardians.findByDocumentNumber(guardian.documentNumber);
    if (duplicate && duplicate.id !== guardian.id) {
      throw new ConflictError(`Ya existe otro acudiente con el documento ${guardian.documentNumber}.`, {
        guardianId: duplicate.id,
      });
    }
    await this.guardians.save(guardian);
    return this.assembler.toView(guardian);
  }
}
