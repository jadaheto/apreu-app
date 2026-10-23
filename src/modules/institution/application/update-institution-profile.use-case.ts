import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { InstitutionProfile, type InstitutionProfileData } from '../domain/institution-profile.js';
import {
  INSTITUTION_PROFILE_REPOSITORY,
  type InstitutionProfileRepository,
} from '../domain/institution-profile.repository.js';
import { toInstitutionProfileView, type InstitutionProfileView } from './institution-profile-view.js';

/** Payload of `institution.profile-updated`. */
export interface InstitutionProfileUpdatedPayload {
  name: string;
  nit: string;
  nitDv: number | null;
}

/**
 * Creates or replaces the institution data (legacy tab "Empresa / RUT" plus
 * the `institutions` row, unified in one place). Publishes
 * `institution.profile-updated` so caches of other contexts can refresh.
 */
@Injectable()
export class UpdateInstitutionProfileUseCase implements UseCase<InstitutionProfileData, InstitutionProfileView> {
  constructor(
    @Inject(INSTITUTION_PROFILE_REPOSITORY) private readonly profiles: InstitutionProfileRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(data: InstitutionProfileData): Promise<InstitutionProfileView> {
    const profile = await this.unitOfWork.runInTransaction(async () => {
      const existing = await this.profiles.find();
      const next = existing ?? InstitutionProfile.create(data);
      if (existing) existing.update(data);
      await this.profiles.save(next);
      return next;
    });

    const payload: InstitutionProfileUpdatedPayload = {
      name: profile.name,
      nit: profile.nit.number,
      nitDv: profile.nit.dv,
    };
    await this.events.publish({
      name: 'institution.profile-updated',
      occurredAt: this.clock.now(),
      payload: { ...payload },
    });
    return toInstitutionProfileView(profile);
  }
}
