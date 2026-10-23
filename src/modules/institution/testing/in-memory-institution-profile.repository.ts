import type { InstitutionProfile } from '../domain/institution-profile.js';
import type { InstitutionProfileRepository } from '../domain/institution-profile.repository.js';

export class InMemoryInstitutionProfileRepository implements InstitutionProfileRepository {
  profile: InstitutionProfile | null = null;
  saves = 0;

  async find(): Promise<InstitutionProfile | null> {
    return this.profile;
  }

  async save(profile: InstitutionProfile): Promise<void> {
    if (profile.isNew) profile.assignId(1);
    this.profile = profile;
    this.saves++;
  }
}
