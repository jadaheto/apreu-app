import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `hr_issued_documents` (migration hr-001). */
@Entity({ name: 'hr_issued_documents' })
export class IssuedDocumentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  @Column({ name: 'issued_by', type: 'integer', nullable: true })
  issuedBy: number | null;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;
}
