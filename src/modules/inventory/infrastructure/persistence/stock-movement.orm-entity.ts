import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { StockMovementType } from '../../domain/stock-movement.js';

/** Mapping of `inventory_movements` (migration inventory-001). */
@Entity({ name: 'inventory_movements' })
export class StockMovementOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'item_id', type: 'integer' })
  itemId: number;

  @Column({ type: 'varchar', length: 10 })
  type: StockMovementType;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter: number;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitCost: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'varchar', length: 50, nullable: true })
  referenceId: string | null;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
