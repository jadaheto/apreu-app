import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AcademicPeriod } from '../../domain/academic-period.js';
import type { AcademicPeriodRepository } from '../../domain/academic-period.repository.js';
import { AcademicPeriodMapper } from './academic-period.mapper.js';
import { AcademicPeriodOrmEntity } from './academic-period.orm-entity.js';

/**
 * Every write targets one row by primary key — the legacy `DB::update(..., $id)`
 * produced `WHERE 5` and updated all periods (B2/B4).
 */
@Injectable()
export class TypeOrmAcademicPeriodRepository implements AcademicPeriodRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<AcademicPeriod | null> {
    const row = await (await this.db.repository(AcademicPeriodOrmEntity)).findOneBy({ id });
    return row ? AcademicPeriodMapper.toDomain(row) : null;
  }

  async findByIds(ids: readonly number[]): Promise<AcademicPeriod[]> {
    if (ids.length === 0) return [];
    const rows = await (await this.db.repository(AcademicPeriodOrmEntity)).findBy({ id: In([...ids]) });
    return rows.map(AcademicPeriodMapper.toDomain);
  }

  async listByYear(year: number): Promise<AcademicPeriod[]> {
    const rows = await (
      await this.db.repository(AcademicPeriodOrmEntity)
    ).find({
      where: { academicYear: year },
      order: { startDate: 'ASC', id: 'ASC' },
    });
    return rows.map(AcademicPeriodMapper.toDomain);
  }

  async hasGrades(periodId: number): Promise<boolean> {
    const rows: { used: boolean }[] = await (
      await this.db.manager()
    ).query('SELECT EXISTS(SELECT 1 FROM student_grades WHERE period_id = $1) AS used', [periodId]);
    return rows[0]?.used === true;
  }

  async save(period: AcademicPeriod): Promise<void> {
    const saved = await (
      await this.db.repository(AcademicPeriodOrmEntity)
    ).save(AcademicPeriodMapper.toPersistence(period));
    if (period.isNew) period.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(AcademicPeriodOrmEntity)).delete({ id });
  }
}
