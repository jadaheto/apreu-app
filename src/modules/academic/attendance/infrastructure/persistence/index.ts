import { TenantEntityRegistry } from '../../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { AttendanceRecordOrmEntity } from './attendance-record.orm-entity.js';

TenantEntityRegistry.register(AttendanceRecordOrmEntity);

export * from './typeorm-attendance-record.repository.js';
