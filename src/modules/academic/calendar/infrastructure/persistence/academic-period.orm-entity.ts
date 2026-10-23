import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { type PeriodStatus } from '../../domain/academic-period.js';

/** Mapping of `academic_periods`. */
@Entity({ name: 'academic_periods' })
export class AcademicPeriodOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: PeriodStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
