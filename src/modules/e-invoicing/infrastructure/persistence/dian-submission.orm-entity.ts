import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `dian_document_submissions` (migration e-invoicing-001). */
@Entity({ name: 'dian_document_submissions' })
export class DianSubmissionOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'dian_invoice_id', type: 'integer' })
  documentId: number;

  @Column({ type: 'varchar', length: 30 })
  operation: string;

  @Column({ type: 'varchar', length: 30 })
  outcome: string;

  @Column({ name: 'status_code', type: 'varchar', length: 10, nullable: true })
  statusCode: string | null;

  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage: string | null;

  /** JSON array of messages. */
  @Column({ type: 'jsonb', nullable: true })
  errors: string[] | null;

  @Column({ name: 'track_id', type: 'varchar', length: 200, nullable: true })
  trackId: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
