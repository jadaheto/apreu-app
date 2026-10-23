import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { CertificateOrmEntity } from './certificate.orm-entity.js';
import { GuardianOrmEntity } from './guardian.orm-entity.js';
import { IncidentOrmEntity } from './incident.orm-entity.js';
import { StudentOrmEntity } from './student.orm-entity.js';

TenantEntityRegistry.register(StudentOrmEntity, GuardianOrmEntity, IncidentOrmEntity, CertificateOrmEntity);

export * from './sql-academic-performance.js';
export * from './sql-certificate-concept-catalog.js';
export * from './sql-classroom-directory.js';
export * from './sql-institution-settings.js';
export * from './sql-student-code-sequence.js';
export * from './sql-student-finance.js';
export * from './sql-user-accounts.js';
export * from './typeorm-certificate.repository.js';
export * from './typeorm-guardian.repository.js';
export * from './typeorm-incident.repository.js';
export * from './typeorm-student.repository.js';
