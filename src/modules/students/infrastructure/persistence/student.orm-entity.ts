import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { BloodType, Gender, StudentDocumentType, StudentStatus } from '../../domain/catalogs.js';
import { decimalTransformer } from './transformers.js';

/** Mapping of the `students` table. */
@Entity({ name: 'students' })
export class StudentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'TI',
  })
  documentType: StudentDocumentType | null;

  @Column({
    name: 'document_number',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  documentNumber: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'M' })
  gender: Gender | null;

  @Column({ name: 'blood_type', type: 'varchar', length: 5, nullable: true })
  bloodType: BloodType | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'active',
  })
  status: StudentStatus;

  @Column({ name: 'guardian_id', type: 'integer', nullable: true })
  guardianId: number | null;

  @Column({ name: 'classroom_id', type: 'integer', nullable: true })
  classroomId: number | null;

  @Column({ name: 'academic_year', type: 'smallint', nullable: true })
  academicYear: number | null;

  @Column({
    name: 'scholarship_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: decimalTransformer,
  })
  scholarshipPct: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photo: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eps: string | null;

  @Column({ name: 'enrollment_date', type: 'date', nullable: true })
  enrollmentDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
