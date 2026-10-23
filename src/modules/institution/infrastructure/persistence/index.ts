import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { InstitutionOrmEntity } from './institution.orm-entity.js';
import { SettingOrmEntity } from './setting.orm-entity.js';

TenantEntityRegistry.register(InstitutionOrmEntity, SettingOrmEntity);

export * from './typeorm-institution-profile.repository.js';
export * from './typeorm-settings.repository.js';
export { InstitutionOrmEntity, SettingOrmEntity };
