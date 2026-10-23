import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `payment_applications` (payment ↔ charge distribution). */
@Entity({ name: 'payment_applications' })
export class PaymentApplicationOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'payment_id', type: 'integer' })
  paymentId: number;

  @Column({ name: 'charge_id', type: 'integer' })
  chargeId: number;

  @Column({ name: 'amount_applied', type: 'numeric', precision: 12, scale: 2 })
  amountApplied: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
