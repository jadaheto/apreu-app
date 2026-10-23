import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { PayrollNovelty } from '../../domain/payroll/payroll-novelty.js';
import type { PayrollNoveltyRepository } from '../../domain/payroll/payroll.repositories.js';
import { PayrollNoveltyMapper } from './payroll.mappers.js';
import { PayrollNoveltyOrmEntity } from './payroll-novelty.orm-entity.js';

/** TypeORM adapter of {@link PayrollNoveltyRepository}. */
@Injectable()
export class TypeOrmPayrollNoveltyRepository implements PayrollNoveltyRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<PayrollNovelty | null> {
    const row = await (await this.db.repository(PayrollNoveltyOrmEntity)).findOneBy({ id });
    return row ? PayrollNoveltyMapper.toDomain(row) : null;
  }

  async findByPeriod(periodId: number): Promise<PayrollNovelty[]> {
    const rows = await (
      await this.db.repository(PayrollNoveltyOrmEntity)
    ).find({
      where: { payrollPeriodId: periodId },
      order: { id: 'ASC' },
    });
    return rows.map(PayrollNoveltyMapper.toDomain);
  }

  async save(novelty: PayrollNovelty): Promise<void> {
    const saved = await (
      await this.db.repository(PayrollNoveltyOrmEntity)
    ).save(PayrollNoveltyMapper.toPersistence(novelty));
    if (novelty.isNew) novelty.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(PayrollNoveltyOrmEntity)).delete({ id });
  }
}
