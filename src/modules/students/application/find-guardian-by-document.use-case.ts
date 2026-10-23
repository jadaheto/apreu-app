import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { GuardianViewAssembler, type GuardianDetailView } from './guardian-view.assembler.js';

/**
 * Looks up a guardian by document number so the enrollment form can reuse it
 * for siblings (new "existing guardian" lookup, analysis 03 §4.2).
 */
@Injectable()
export class FindGuardianByDocumentUseCase implements UseCase<string, GuardianDetailView> {
  constructor(
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    private readonly assembler: GuardianViewAssembler,
  ) {}

  async execute(documentNumber: string): Promise<GuardianDetailView> {
    const guardian = await this.guardians.findByDocumentNumber(documentNumber.trim());
    if (!guardian) throw new NotFoundError('Acudiente con documento', documentNumber);
    return this.assembler.toView(guardian);
  }
}
