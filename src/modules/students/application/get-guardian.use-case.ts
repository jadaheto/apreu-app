import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { GuardianViewAssembler, type GuardianDetailView } from './guardian-view.assembler.js';

/** Returns a guardian with the students linked to it. */
@Injectable()
export class GetGuardianUseCase implements UseCase<number, GuardianDetailView> {
  constructor(
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    private readonly assembler: GuardianViewAssembler,
  ) {}

  async execute(guardianId: number): Promise<GuardianDetailView> {
    const guardian = await this.guardians.findById(guardianId);
    if (!guardian) throw new NotFoundError('Acudiente', guardianId);
    return this.assembler.toView(guardian);
  }
}
