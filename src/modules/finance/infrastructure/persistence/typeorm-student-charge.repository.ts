import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { BillingPeriod } from '../../domain/billing-period.vo.js';
import type { StudentCharge } from '../../domain/student-charge.js';
import type { LockOptions, StudentChargeRepository } from '../../domain/student-charge.repository.js';
import { StudentChargeMapper } from './finance.mappers.js';
import { SqlParams } from '../../../../shared/infrastructure/persistence/sql.js';
import { chargeInPeriodSql } from './sql.js';
import { StudentChargeOrmEntity } from './student-charge.orm-entity.js';

const OPEN_STATUSES = ['pending', 'partial', 'overdue'];

/** `student_charges` repository; hydrated charges carry Σ applications of applied payments. */
@Injectable()
export class TypeOrmStudentChargeRepository implements StudentChargeRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number, options?: LockOptions): Promise<StudentCharge | null> {
    return (await this.findByIds([id], options))[0] ?? null;
  }

  async findByIds(ids: number[], options?: LockOptions): Promise<StudentCharge[]> {
    if (ids.length === 0) return [];
    return this.load(options, (query) => query.where('sc.id IN (:...ids)', { ids }));
  }

  async findByStudent(studentId: number): Promise<StudentCharge[]> {
    return this.load({}, (query) => query.where('sc.student_id = :studentId', { studentId }));
  }

  async findOpenByStudent(studentId: number, options?: LockOptions): Promise<StudentCharge[]> {
    const charges = await this.load(options, (query) =>
      query
        .where('sc.student_id = :studentId', { studentId })
        .andWhere('sc.status IN (:...open)', { open: OPEN_STATUSES }),
    );
    return charges.filter((charge) => charge.isOpen);
  }

  async studentsAlreadyCharged(conceptId: number, period: BillingPeriod, studentIds: number[]): Promise<Set<number>> {
    if (studentIds.length === 0) return new Set();
    const params = new SqlParams();
    const sql = `SELECT DISTINCT sc.student_id FROM student_charges sc
       WHERE sc.concept_id = ${params.add(conceptId)} AND sc.status <> 'cancelled'
         AND ${chargeInPeriodSql('sc', params, { period: period.toString(), firstDay: period.firstDay(), lastDay: period.lastDay() })}
         AND sc.student_id = ANY(${params.add(studentIds)})`;
    const rows: { student_id: number }[] = await (await this.db.manager()).query(sql, params.values);
    return new Set(rows.map((row) => Number(row.student_id)));
  }

  async save(charge: StudentCharge): Promise<void> {
    await this.saveMany([charge]);
  }

  async saveMany(charges: StudentCharge[]): Promise<void> {
    if (charges.length === 0) return;
    const saved = await (
      await this.db.repository(StudentChargeOrmEntity)
    ).save(charges.map(StudentChargeMapper.toPersistence));
    charges.forEach((charge, index) => {
      if (charge.isNew) charge.assignId(saved[index].id);
    });
  }

  private async load(
    options: LockOptions | undefined,
    filter: (query: ReturnType<EntityManager['createQueryBuilder']>) => unknown,
  ): Promise<StudentCharge[]> {
    const manager = await this.db.manager();
    const query = manager.createQueryBuilder(StudentChargeOrmEntity, 'sc');
    filter(query);
    query.orderBy('sc.due_date', 'ASC').addOrderBy('sc.id', 'ASC');
    if (options?.forUpdate) query.setLock('pessimistic_write');
    const rows = (await query.getMany()) as StudentChargeOrmEntity[];
    const paid = await this.paidByCharge(
      manager,
      rows.map((row) => row.id),
    );
    return rows.map((row) => StudentChargeMapper.toDomain(row, paid.get(row.id) ?? Money.zero()));
  }

  private async paidByCharge(manager: EntityManager, ids: number[]): Promise<Map<number, Money>> {
    if (ids.length === 0) return new Map();
    const rows: { charge_id: number; paid: string }[] = await manager.query(
      `SELECT pa.charge_id, SUM(pa.amount_applied) AS paid
       FROM payment_applications pa
       INNER JOIN payments p ON p.id = pa.payment_id AND p.status = 'applied'
       WHERE pa.charge_id = ANY($1)
       GROUP BY pa.charge_id`,
      [ids],
    );
    return new Map(rows.map((row) => [Number(row.charge_id), Money.of(row.paid)]));
  }
}
