import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { Role } from '../../../shared/domain/role.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { SettingsCatalog } from '../domain/settings/settings-catalog.js';
import { SettingsSection } from '../domain/settings/settings-section.js';
import { SETTINGS_REPOSITORY, type SettingsRepository } from '../domain/settings/settings.repository.js';
import type { SettingsSectionView } from './settings-views.js';

export interface GetSettingsSectionInput {
  role: Role;
  section: string;
}

/** Values of one tab with secrets masked (legacy reprinted secrets in the HTML, S7). */
@Injectable()
export class GetSettingsSectionUseCase implements UseCase<GetSettingsSectionInput, SettingsSectionView> {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ role, section }: GetSettingsSectionInput): Promise<SettingsSectionView> {
    const definition = SettingsCatalog.editableSection(role, section);
    const stored = await this.settings.findMany(SettingsSection.keysOf(definition));
    const values = SettingsSection.load(definition, stored, { now: this.clock.now() }).values();
    return { section: definition.key, label: definition.label, values };
  }
}
