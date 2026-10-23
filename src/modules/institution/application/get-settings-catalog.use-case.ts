import { Injectable } from '@nestjs/common';
import type { Role } from '../../../shared/domain/role.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { SettingsCatalog } from '../domain/settings/settings-catalog.js';
import { toSectionMetadata, type SettingsSectionMetadataView } from './settings-views.js';

/** Tabs (and their typed fields) the role may configure: admin all; finance DIAN and payments; HR payroll. */
@Injectable()
export class GetSettingsCatalogUseCase implements UseCase<Role, SettingsSectionMetadataView[]> {
  async execute(role: Role): Promise<SettingsSectionMetadataView[]> {
    return SettingsCatalog.sectionsFor(role).map(toSectionMetadata);
  }
}
