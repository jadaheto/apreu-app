import { TenantEntityRegistry } from '../../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { AcademicPeriodOrmEntity } from './academic-period.orm-entity.js';

TenantEntityRegistry.register(AcademicPeriodOrmEntity);

export * from './typeorm-academic-period.repository.js';
