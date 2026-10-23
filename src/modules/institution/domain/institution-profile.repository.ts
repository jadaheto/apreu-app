import type { InstitutionProfile } from './institution-profile.js';

/** Output port for the (single) institution profile of the school. */
export interface InstitutionProfileRepository {
  /** `null` while the school has not configured its data. */
  find(): Promise<InstitutionProfile | null>;
  /** Inserts or updates; assigns the id to a new profile. */
  save(profile: InstitutionProfile): Promise<void>;
}

export const INSTITUTION_PROFILE_REPOSITORY = Symbol('InstitutionProfileRepository');
