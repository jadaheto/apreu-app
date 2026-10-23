import { TenantEntityRegistry } from '../../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import {
  ClassroomOrmEntity,
  GradeOrmEntity,
  GroupDirectorOrmEntity,
  SubjectOrmEntity,
  TeacherAssignmentOrmEntity,
} from './structure.orm-entities.js';

TenantEntityRegistry.register(
  GradeOrmEntity,
  SubjectOrmEntity,
  ClassroomOrmEntity,
  TeacherAssignmentOrmEntity,
  GroupDirectorOrmEntity,
);

export * from './typeorm-structure.repositories.js';
