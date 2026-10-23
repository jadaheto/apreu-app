import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { CertificateSnapshot, CertificateStatus } from '../../domain/certificate.js';

/** Mapping of the `certificates` table (+ `verification_code`, `snapshot` from migration `students-001`). */
@Entity({ name: 'certificates' })
export class CertificateOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  @Column({ type: 'varchar', length: 80, default: 'certificado_estudiantil' })
  type: string;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'pending',
  })
  status: CertificateStatus | null;

  @Column({ name: 'payment_id', type: 'integer', nullable: true })
  paymentId: number | null;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ name: 'pdf_path', type: 'varchar', length: 255, nullable: true })
  pdfPath: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @Column({
    name: 'verification_code',
    type: 'varchar',
    length: 64,
    nullable: true,
    unique: true,
  })
  verificationCode: string | null;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: CertificateSnapshot | null;
}
