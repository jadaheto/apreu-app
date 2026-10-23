import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/infrastructure/orm-support.js';

/**
 * Mapping of `student_grades`. `period` is the legacy NOT NULL period number
 * (part of the legacy unique key); `period_id` is the real key (B1).
 */
@Entity({ name: 'student_grades' })
export class StudentGradeOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  @Column({ name: 'subject_id', type: 'integer' })
  subjectId: number;

  @Column({ name: 'period_id', type: 'integer', nullable: true })
  periodId: number | null;

  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear: number;

  @Column({ name: 'period', type: 'smallint' })
  periodNumber: number;

  @Column({
    name: 'score_cognitive',
    type: 'numeric',
    precision: 3,
    scale: 1,
    default: 0,
    transformer: decimalTransformer,
  })
  scoreCognitive: number;

  @Column({
    name: 'score_procedural',
    type: 'numeric',
    precision: 3,
    scale: 1,
    default: 0,
    transformer: decimalTransformer,
  })
  scoreProcedural: number;

  @Column({
    name: 'score_attitudinal',
    type: 'numeric',
    precision: 3,
    scale: 1,
    default: 0,
    transformer: decimalTransformer,
  })
  scoreAttitudinal: number;

  @Column({ name: 'final_score', type: 'numeric', precision: 3, scale: 1, default: 0, transformer: decimalTransformer })
  finalScore: number;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `student_bulletins` (report cards). */
@Entity({ name: 'student_bulletins' })
export class StudentBulletinOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  @Column({ name: 'period_id', type: 'integer' })
  periodId: number;

  @Column({ name: 'pdf_path', type: 'varchar', length: 255 })
  pdfPath: string;

  @Column({
    name: 'average_score',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  averageScore: number;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ name: 'download_count', type: 'integer', default: 0 })
  downloadCount: number;

  @Column({ name: 'last_download_at', type: 'timestamptz', nullable: true })
  lastDownloadAt: Date | null;
}
