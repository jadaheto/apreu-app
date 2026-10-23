import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError } from '../../../shared/domain/domain-error.js';
import { Guardian, type GuardianDetails } from '../domain/guardian.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { GuardianViewAssembler, type GuardianDetailView } from './guardian-view.assembler.js';

/** Registers a guardian; the document number must be unique in the school. */
@Injectable()
export class CreateGuardianUseCase implements UseCase<GuardianDetails, GuardianDetailView> {
  constructor(
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    private readonly assembler: GuardianViewAssembler,
  ) {}

  async execute(details: GuardianDetails): Promise<GuardianDetailView> {
    const guardian = Guardian.create(details);
    const existing = await this.guardians.findByDocumentNumber(guardian.documentNumber);
    if (existing) {
      throw new ConflictError(`Ya existe un acudiente con el documento ${guardian.documentNumber}.`, {
        guardianId: existing.id,
      });
    }
    await this.guardians.save(guardian);
    return this.assembler.toView(guardian);
  }
}
