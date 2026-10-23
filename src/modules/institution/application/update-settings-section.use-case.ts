import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { Role } from '../../../shared/domain/role.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { SettingsCatalog, type SettingsSectionKey } from '../domain/settings/settings-catalog.js';
import { SettingsSection } from '../domain/settings/settings-section.js';
import { SETTINGS_REPOSITORY, type SettingsRepository } from '../domain/settings/settings.repository.js';
import type { SettingsSectionView } from './settings-views.js';

export interface UpdateSettingsSectionInput {
  role: Role;
  section: string;
  /** Partial update: only the keys present are written (`null` clears). */
  values: Record<string, unknown>;
}

/** Payload of `institution.settings-updated` (keys only, never values: they may be secrets). */
export interface SettingsUpdatedPayload {
  section: SettingsSectionKey;
  keys: string[];
}

/**
 * Saves part of a tab (legacy `settings.php` generic save). Every key must
 * belong to the section's typed catalog and pass its validation; section
 * rules (e.g. DIAN numbering range) run on the merged values; the write is
 * atomic. A secret sent back as the mask keeps its stored value.
 */
@Injectable()
export class UpdateSettingsSectionUseCase implements UseCase<UpdateSettingsSectionInput, SettingsSectionView> {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ role, section, values }: UpdateSettingsSectionInput): Promise<SettingsSectionView> {
    const definition = SettingsCatalog.editableSection(role, section);
    const keys = SettingsSection.keysOf(definition);
    const context = { now: this.clock.now() };

    const { changedKeys, stored } = await this.unitOfWork.runInTransaction(async () => {
      const current = await this.settings.findMany(keys);
      const changes = SettingsSection.load(definition, current, context).change(values);
      if (changes.writes.size) await this.settings.saveMany(changes.writes);
      return { changedKeys: changes.changedKeys, stored: new Map([...current, ...changes.writes]) };
    });

    if (changedKeys.length) {
      const payload: SettingsUpdatedPayload = { section: definition.key, keys: changedKeys };
      await this.events.publish({
        name: 'institution.settings-updated',
        occurredAt: this.clock.now(),
        payload: { ...payload },
      });
    }
    return {
      section: definition.key,
      label: definition.label,
      values: SettingsSection.load(definition, stored, context).values(),
    };
  }
}
