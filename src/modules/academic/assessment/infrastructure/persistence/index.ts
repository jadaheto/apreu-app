import { TenantEntityRegistry } from '../../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { StudentBulletinOrmEntity, StudentGradeOrmEntity } from './assessment.orm-entities.js';

TenantEntityRegistry.register(StudentGradeOrmEntity, StudentBulletinOrmEntity);

export * from './typeorm-assessment.repositories.js';
