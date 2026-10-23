import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { BillingConceptOrmEntity } from './billing-concept.orm-entity.js';
import { ExpenseCategoryOrmEntity } from './expense-category.orm-entity.js';
import { ExpenseOrmEntity } from './expense.orm-entity.js';
import { GradeTuitionOrmEntity } from './grade-tuition.orm-entity.js';
import { PaymentApplicationOrmEntity } from './payment-application.orm-entity.js';
import { PaymentOrmEntity } from './payment.orm-entity.js';
import { StudentChargeOrmEntity } from './student-charge.orm-entity.js';

TenantEntityRegistry.register(
  BillingConceptOrmEntity,
  GradeTuitionOrmEntity,
  StudentChargeOrmEntity,
  PaymentOrmEntity,
  PaymentApplicationOrmEntity,
  ExpenseOrmEntity,
  ExpenseCategoryOrmEntity,
);

export * from './queries/sql-aging-source.js';
export * from './queries/sql-charge-queries.js';
export * from './queries/sql-dashboard-queries.js';
export * from './queries/sql-finance-settings.js';
export * from './queries/sql-grade-catalog.js';
export * from './queries/sql-payment-queries.js';
export * from './queries/sql-payroll-disbursement-source.js';
export * from './queries/sql-student-directory.js';
export * from './queries/sql-student-links.js';
export * from './sql-receipt-sequence.js';
export * from './typeorm-billing-concept.repository.js';
export * from './typeorm-expense-category.repository.js';
export * from './typeorm-expense.repository.js';
export * from './typeorm-payment.repository.js';
export * from './typeorm-student-charge.repository.js';
export * from './typeorm-tuition-schedule.repository.js';
