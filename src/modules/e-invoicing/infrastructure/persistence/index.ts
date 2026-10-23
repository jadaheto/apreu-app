import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { DianSubmissionOrmEntity } from './dian-submission.orm-entity.js';
import { ElectronicDocumentOrmEntity } from './electronic-document.orm-entity.js';
import { NumberingResolutionOrmEntity } from './numbering-resolution.orm-entity.js';

TenantEntityRegistry.register(ElectronicDocumentOrmEntity, DianSubmissionOrmEntity, NumberingResolutionOrmEntity);

export * from './secret-cipher.js';
export * from './settings-issuer-config.repository.js';
export * from './sql-charge-tax.js';
export * from './sql-payer-directory.js';
export * from './typeorm-electronic-document.repository.js';
export * from './typeorm-numbering-resolution.repository.js';
export * from './sql-portal-student-links.js';
