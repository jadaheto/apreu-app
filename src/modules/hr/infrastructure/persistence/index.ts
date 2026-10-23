import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { EmployeeStickerOrmEntity } from './employee-sticker.orm-entity.js';
import { EmployeeOrmEntity } from './employee.orm-entity.js';
import { IssuedDocumentOrmEntity } from './issued-document.orm-entity.js';
import { LeaveRequestOrmEntity } from './leave-request.orm-entity.js';
import { PayrollNoveltyOrmEntity } from './payroll-novelty.orm-entity.js';
import { PayrollParametersOrmEntity } from './payroll-parameters.orm-entity.js';
import { PayrollPaymentOrmEntity } from './payroll-payment.orm-entity.js';
import { PayrollPeriodOrmEntity } from './payroll-period.orm-entity.js';

TenantEntityRegistry.register(
  EmployeeOrmEntity,
  LeaveRequestOrmEntity,
  PayrollPeriodOrmEntity,
  PayrollPaymentOrmEntity,
  PayrollNoveltyOrmEntity,
  PayrollParametersOrmEntity,
  IssuedDocumentOrmEntity,
  EmployeeStickerOrmEntity,
);

export * from './sql-institution-profile.js';
export * from './sql-user-accounts.js';
export * from './typeorm-employee-sticker.repository.js';
export * from './typeorm-employee.repository.js';
export * from './typeorm-issued-document.repository.js';
export * from './typeorm-leave-request.repository.js';
export * from './typeorm-payroll-novelty.repository.js';
export * from './typeorm-payroll-parameters.repository.js';
export * from './typeorm-payroll-payment.repository.js';
export * from './typeorm-payroll-period.repository.js';
