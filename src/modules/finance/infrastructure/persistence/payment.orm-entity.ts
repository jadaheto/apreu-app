import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { type PaymentMethod } from '../../domain/payment-method.js';
import { type PaymentStatus } from '../../domain/payment.js';

/** Mapping of `payments`. `voided_*` columns are added by migration `finance-003`. */
@Entity({ name: 'payments' })
export class PaymentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  @Column({ name: 'receipt_no', type: 'varchar', length: 50, nullable: true })
  receiptNo: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 20, nullable: true, default: 'efectivo' })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'payment_date', type: 'timestamptz', nullable: true })
  paymentDate: Date | null;

  @Column({ name: 'cashier_id', type: 'integer', nullable: true })
  cashierId: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'applied' })
  status: PaymentStatus | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ name: 'bank_ref', type: 'varchar', length: 100, nullable: true })
  bankRef: string | null;

  @Column({ type: 'boolean', default: false })
  reconciled: boolean;

  @Column({ name: 'reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt: Date | null;

  @Column({ name: 'reconciled_by', type: 'integer', nullable: true })
  reconciledBy: number | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'voided_by', type: 'integer', nullable: true })
  voidedBy: number | null;

  @Column({ name: 'void_reason', type: 'varchar', length: 255, nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
