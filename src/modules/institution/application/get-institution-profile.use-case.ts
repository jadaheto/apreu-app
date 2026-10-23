import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  INSTITUTION_PROFILE_REPOSITORY,
  type InstitutionProfileRepository,
} from '../domain/institution-profile.repository.js';
import { toInstitutionProfileView, type InstitutionProfileView } from './institution-profile-view.js';

/** Institution data (404 while the school has not configured it). */
@Injectable()
export class GetInstitutionProfileUseCase implements UseCase<void, InstitutionProfileView> {
  constructor(@Inject(INSTITUTION_PROFILE_REPOSITORY) private readonly profiles: InstitutionProfileRepository) {}

  async execute(): Promise<InstitutionProfileView> {
    const profile = await this.profiles.find();
    if (!profile) throw new NotFoundError('Perfil de la institución', 'actual');
    return toInstitutionProfileView(profile);
  }
}
