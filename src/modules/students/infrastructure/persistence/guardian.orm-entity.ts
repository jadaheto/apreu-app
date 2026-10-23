import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { GuardianDocumentType, Relationship } from '../../domain/catalogs.js';

/** Mapping of the `guardians` table (+ `user_id` from migration `students-001`). */
@Entity({ name: 'guardians' })
export class GuardianOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'cc',
  })
  documentType: GuardianDocumentType | null;

  @Column({
    name: 'document_number',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  documentNumber: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  occupation: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'padre',
  })
  relationship: Relationship | null;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
