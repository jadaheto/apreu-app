import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `expenses`. */
@Entity({ name: 'expenses' })
export class ExpenseOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'category_id', type: 'integer', nullable: true })
  categoryId: number | null;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor: string | null;

  @Column({ name: 'receipt_no', type: 'varchar', length: 100, nullable: true })
  receiptNo: string | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, nullable: true, default: 'efectivo' })
  paymentMethod: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
