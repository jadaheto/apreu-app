import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { PayrollParameters } from '../../domain/payroll/payroll-parameters.js';
import type { PayrollParametersRepository } from '../../domain/payroll/payroll-parameters.repository.js';
import { PayrollParametersMapper } from './payroll.mappers.js';
import { PayrollParametersOrmEntity } from './payroll-parameters.orm-entity.js';

/** TypeORM adapter of {@link PayrollParametersRepository}. */
@Injectable()
export class TypeOrmPayrollParametersRepository implements PayrollParametersRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findByYear(year: number): Promise<PayrollParameters | null> {
    const row = await (await this.db.repository(PayrollParametersOrmEntity)).findOneBy({ year });
    return row ? PayrollParametersMapper.toDomain(row) : null;
  }

  async save(params: PayrollParameters, updatedBy: number): Promise<void> {
    await (
      await this.db.repository(PayrollParametersOrmEntity)
    ).save(PayrollParametersMapper.toPersistence(params, updatedBy));
  }
}
