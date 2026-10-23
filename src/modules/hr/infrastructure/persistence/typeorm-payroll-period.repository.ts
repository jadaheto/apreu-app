import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { toOffset, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { IsoDate } from '../../domain/common/calendar-date.js';
import type { PayrollPeriod } from '../../domain/payroll/payroll-period.js';
import type { PayrollPeriodCriteria, PayrollPeriodRepository } from '../../domain/payroll/payroll.repositories.js';
import { PayrollPeriodMapper } from './payroll.mappers.js';
import { PayrollPeriodOrmEntity } from './payroll-period.orm-entity.js';

/** TypeORM adapter of {@link PayrollPeriodRepository}. */
@Injectable()
export class TypeOrmPayrollPeriodRepository implements PayrollPeriodRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<PayrollPeriod | null> {
    const row = await (await this.db.repository(PayrollPeriodOrmEntity)).findOneBy({ id });
    return row ? PayrollPeriodMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<PayrollPeriod[]> {
    if (ids.length === 0) return [];
    return (await (await this.db.repository(PayrollPeriodOrmEntity)).findBy({ id: In(ids) })).map(
      PayrollPeriodMapper.toDomain,
    );
  }

  async search(criteria: PayrollPeriodCriteria, page: PageRequest): Promise<Paginated<PayrollPeriod>> {
    const query = (await this.db.repository(PayrollPeriodOrmEntity)).createQueryBuilder('p');
    if (criteria.year) query.andWhere('p.year = :year', { year: criteria.year });
    if (criteria.status) query.andWhere('p.status = :status', { status: criteria.status });
    const [rows, total] = await query
      .orderBy('p.period_start', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(PayrollPeriodMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async findOverlapping(start: IsoDate, end: IsoDate, excludeId?: number): Promise<PayrollPeriod[]> {
    const query = (await this.db.repository(PayrollPeriodOrmEntity))
      .createQueryBuilder('p')
      .where("p.status <> 'cancelled'")
      .andWhere('p.period_start <= :end AND p.period_end >= :start', { start, end });
    if (excludeId !== undefined) query.andWhere('p.id <> :excludeId', { excludeId });
    return (await query.getMany()).map(PayrollPeriodMapper.toDomain);
  }

  async existsPaidInYear(year: number): Promise<boolean> {
    return (await this.db.repository(PayrollPeriodOrmEntity)).exists({ where: { year, status: 'paid' } });
  }

  async save(period: PayrollPeriod): Promise<void> {
    const saved = await (
      await this.db.repository(PayrollPeriodOrmEntity)
    ).save(PayrollPeriodMapper.toPersistence(period));
    if (period.isNew) period.assignId(saved.id);
  }
}
