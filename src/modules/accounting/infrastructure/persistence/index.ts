import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { AccountOrmEntity } from './account.orm-entity.js';
import { AccountingPeriodOrmEntity } from './accounting-period.orm-entity.js';
import { JournalEntryOrmEntity } from './journal-entry.orm-entity.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';
import { PostingRuleOrmEntity } from './posting-rule.orm-entity.js';
import { ThirdPartyOrmEntity } from './third-party.orm-entity.js';

TenantEntityRegistry.register(
  AccountOrmEntity,
  ThirdPartyOrmEntity,
  AccountingPeriodOrmEntity,
  JournalEntryOrmEntity,
  JournalLineOrmEntity,
  PostingRuleOrmEntity,
);

export * from './typeorm-account.repository.js';
export * from './typeorm-accounting-period.repository.js';
export * from './typeorm-journal-entry.repository.js';
export * from './typeorm-ledger-query.js';
export * from './typeorm-posting-rule.repository.js';
export * from './typeorm-third-party.repository.js';
export * from './typeorm-voucher-sequence.js';
