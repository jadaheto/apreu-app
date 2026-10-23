import { Injectable } from '@nestjs/common';
import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AccountingPeriod } from '../../domain/accounting-period.js';
import type { AccountingPeriodRepository } from '../../domain/accounting-period.repository.js';
import { AccountingPeriodOrmEntity } from './accounting-period.orm-entity.js';
import { AccountingPeriodMapper } from './accounting.mappers.js';

@Injectable()
export class TypeOrmAccountingPeriodRepository implements AccountingPeriodRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<AccountingPeriod | null> {
    const row = await (await this.db.repository(AccountingPeriodOrmEntity)).findOneBy({ id });
    return row ? AccountingPeriodMapper.toDomain(row) : null;
  }

  async findAll(): Promise<AccountingPeriod[]> {
    const rows = await (
      await this.db.repository(AccountingPeriodOrmEntity)
    ).find({ order: { startDate: 'DESC', id: 'DESC' } });
    return rows.map(AccountingPeriodMapper.toDomain);
  }

  async findOverlapping(startDate: string, endDate: string): Promise<AccountingPeriod[]> {
    const rows = await (
      await this.db.repository(AccountingPeriodOrmEntity)
    ).find({
      where: { startDate: LessThanOrEqual(endDate), endDate: MoreThanOrEqual(startDate) },
      order: { startDate: 'ASC' },
    });
    return rows.map(AccountingPeriodMapper.toDomain);
  }

  async findContaining(day: string): Promise<AccountingPeriod[]> {
    const rows = await (
      await this.db.repository(AccountingPeriodOrmEntity)
    ).find({
      where: { startDate: LessThanOrEqual(day), endDate: MoreThanOrEqual(day) },
      order: { startDate: 'DESC', id: 'DESC' },
    });
    return rows.map(AccountingPeriodMapper.toDomain);
  }

  async save(period: AccountingPeriod): Promise<void> {
    const saved = await (
      await this.db.repository(AccountingPeriodOrmEntity)
    ).save(AccountingPeriodMapper.toPersistence(period));
    if (period.isNew) period.assignId(saved.id);
  }
}
