import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { AccessLogOrmEntity } from './access-log.orm-entity.js';
import { UserOrmEntity } from './user.orm-entity.js';

TenantEntityRegistry.register(UserOrmEntity, AccessLogOrmEntity);

export * from './sql-access-log-query.js';
export * from './sql-employment-status.js';
export * from './sql-module-toggles.js';
export * from './typeorm-access-log.js';
export * from './typeorm-user.repository.js';
export { UserOrmEntity, AccessLogOrmEntity };
