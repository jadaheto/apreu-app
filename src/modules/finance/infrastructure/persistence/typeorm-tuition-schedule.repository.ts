import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { TuitionSchedule } from '../../domain/tuition-schedule.js';
import type { TuitionScheduleRepository } from '../../domain/tuition-schedule.repository.js';
import { GradeTuitionOrmEntity } from './grade-tuition.orm-entity.js';

@Injectable()
export class TypeOrmTuitionScheduleRepository implements TuitionScheduleRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findByYear(academicYear: number): Promise<TuitionSchedule> {
    const rows = await (
      await this.db.repository(GradeTuitionOrmEntity)
    ).find({
      where: { academicYear },
      order: { gradeId: 'ASC', conceptId: 'ASC' },
    });
    return TuitionSchedule.restore(
      academicYear,
      rows.map((row) => ({ gradeId: row.gradeId, conceptId: row.conceptId, amount: Money.of(row.amount) })),
    );
  }

  async replace(schedule: TuitionSchedule): Promise<void> {
    const repository = await this.db.repository(GradeTuitionOrmEntity);
    await repository.delete({ academicYear: schedule.academicYear });
    if (schedule.all.length === 0) return;
    await repository.insert(
      schedule.all.map((rate) => ({
        gradeId: rate.gradeId,
        conceptId: rate.conceptId,
        amount: rate.amount.amount.toFixed(2),
        academicYear: schedule.academicYear,
      })),
    );
  }
}
