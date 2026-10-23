import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `grade_tuition` (UNIQUE grade_id, concept_id, academic_year). */
@Entity({ name: 'grade_tuition' })
export class GradeTuitionOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'grade_id', type: 'integer' })
  gradeId: number;

  @Column({ name: 'concept_id', type: 'integer', nullable: true })
  conceptId: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amount: string;

  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
