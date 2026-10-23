import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { Payment } from '../../domain/payment.js';
import type { PaymentRepository } from '../../domain/payment.repository.js';
import type { LockOptions } from '../../domain/student-charge.repository.js';
import { PaymentMapper } from './finance.mappers.js';
import { PaymentApplicationOrmEntity } from './payment-application.orm-entity.js';
import { PaymentOrmEntity } from './payment.orm-entity.js';

/** `payments` + `payment_applications` repository. */
@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number, options?: LockOptions): Promise<Payment | null> {
    return (await this.load([id], options))[0] ?? null;
  }

  async findWithCredit(studentId: number, options?: LockOptions): Promise<Payment[]> {
    const rows: { id: number }[] = await (
      await this.db.manager()
    ).query(
      `SELECT p.id
       FROM payments p
       LEFT JOIN payment_applications pa ON pa.payment_id = p.id
       WHERE p.student_id = $1 AND p.status = 'applied'
       GROUP BY p.id, p.amount
       HAVING p.amount - COALESCE(SUM(pa.amount_applied), 0) > 0`,
      [studentId],
    );
    return this.load(
      rows.map((row) => Number(row.id)),
      options,
    );
  }

  async isBankRefTaken(bankRef: string, exceptPaymentId: number): Promise<boolean> {
    const count = await (
      await this.db.repository(PaymentOrmEntity)
    )
      .createQueryBuilder('p')
      // Case/space-insensitive (ADR-0008): `trx-1` and `TRX-1 ` are the same bank reference.
      .where('upper(btrim(p.bank_ref)) = upper(btrim(:bankRef))', { bankRef })
      .andWhere('p.id <> :id', { id: exceptPaymentId })
      .getCount();
    return count > 0;
  }

  async save(payment: Payment): Promise<void> {
    const manager = await this.db.manager();
    const saved = await manager.getRepository(PaymentOrmEntity).save(PaymentMapper.toPersistence(payment));
    if (payment.isNew) payment.assignId(saved.id);
    const pending = payment.pendingApplications;
    if (pending.length === 0) return;
    const inserted = await manager.getRepository(PaymentApplicationOrmEntity).save(
      pending.map((application) =>
        manager.getRepository(PaymentApplicationOrmEntity).create({
          paymentId: payment.id as number,
          chargeId: application.chargeId,
          amountApplied: application.amount.amount.toFixed(2),
        }),
      ),
    );
    payment.assignApplicationIds(inserted.map((row) => row.id));
  }

  /** Loads payments (oldest first) with their applications, optionally locking the payment rows. */
  private async load(ids: number[], options?: LockOptions): Promise<Payment[]> {
    if (ids.length === 0) return [];
    const manager: EntityManager = await this.db.manager();
    const query = manager
      .createQueryBuilder(PaymentOrmEntity, 'p')
      .where('p.id IN (:...ids)', { ids })
      .orderBy('p.payment_date', 'ASC')
      .addOrderBy('p.id', 'ASC');
    if (options?.forUpdate) query.setLock('pessimistic_write');
    const rows = await query.getMany();
    const applications = await manager
      .getRepository(PaymentApplicationOrmEntity)
      .find({ where: { paymentId: In(ids) }, order: { id: 'ASC' } });
    return rows.map((row) =>
      PaymentMapper.toDomain(
        row,
        applications.filter((application) => application.paymentId === row.id),
      ),
    );
  }
}
