import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { InstitutionProfile } from '../../domain/institution-profile.js';
import type { InstitutionProfileRepository } from '../../domain/institution-profile.repository.js';
import { InstitutionProfileMapper, PROFILE_SETTING_KEYS } from './institution-profile.mapper.js';
import { InstitutionOrmEntity } from './institution.orm-entity.js';
import { TypeOrmSettingsRepository } from './typeorm-settings.repository.js';

/**
 * Persists the profile in the first `institutions` row plus its `settings`
 * keys. Call {@link save} inside a unit of work so both writes are atomic.
 */
@Injectable()
export class TypeOrmInstitutionProfileRepository implements InstitutionProfileRepository {
  constructor(
    private readonly db: TenantDataSource,
    private readonly settings: TypeOrmSettingsRepository,
  ) {}

  async find(): Promise<InstitutionProfile | null> {
    const [rows, settings] = await Promise.all([
      (await this.db.repository(InstitutionOrmEntity)).find({ order: { id: 'ASC' }, take: 1 }),
      this.settings.findMany(Object.values(PROFILE_SETTING_KEYS)),
    ]);
    return InstitutionProfileMapper.toDomain(rows[0] ?? null, settings);
  }

  async save(profile: InstitutionProfile): Promise<void> {
    const saved = await (await this.db.repository(InstitutionOrmEntity)).save(InstitutionProfileMapper.toRow(profile));
    if (profile.isNew) profile.assignId(saved.id);
    await this.settings.saveMany(InstitutionProfileMapper.toSettings(profile));
  }
}
