import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Mapping of `dian_consecutives` (+ migration e-invoicing-001). */
@Entity({ name: 'dian_consecutives' })
export class NumberingResolutionOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 10 })
  prefix: string;

  @Column({ name: 'doc_type', type: 'varchar', length: 10, default: 'fv' })
  docType: 'fv' | 'nd' | 'nc';

  @Column({ name: 'range_from', type: 'integer', default: 1 })
  rangeFrom: number;

  @Column({ name: 'range_to', type: 'integer', default: 100000 })
  rangeTo: number;

  @Column({ name: 'current_consecutive', type: 'integer', default: 0 })
  currentConsecutive: number;

  @Column({ name: 'resolution_number', type: 'varchar', length: 50, nullable: true })
  resolutionNumber: string | null;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;

  @Column({ name: 'technical_key', type: 'varchar', length: 512, nullable: true })
  technicalKey: string | null;

  @Column({ type: 'varchar', length: 10, default: '2' })
  environment: '1' | '2';

  @Column({ name: 'numbering_cycle', type: 'integer', default: 0 })
  numberingCycle: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
