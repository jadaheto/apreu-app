import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { type ConceptCategory } from '../../domain/concept-category.js';

/** Mapping of `billing_concepts`. Decimals are read as strings to keep precision. */
@Entity({ name: 'billing_concepts' })
export class BillingConceptOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'pension' })
  category: ConceptCategory | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amount: string;

  @Column({ name: 'tax_rate', type: 'numeric', precision: 5, scale: 2, nullable: true, default: 0 })
  taxRate: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true, default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
