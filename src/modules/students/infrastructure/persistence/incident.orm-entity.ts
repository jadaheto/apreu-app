import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { IncidentPriority, IncidentStatus, IncidentType } from '../../domain/incident.js';

/** Mapping of the `incidents` table. Timestamps are written from the domain (clock port). */
@Entity({ name: 'incidents' })
export class IncidentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer', nullable: true })
  studentId: number | null;

  @Column({ name: 'requested_by', type: 'integer', nullable: true })
  requestedBy: number | null;

  @Column({ name: 'reviewed_by', type: 'integer', nullable: true })
  reviewedBy: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    default: 'otra',
  })
  type: IncidentType | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'medium',
  })
  priority: IncidentPriority | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'pending',
  })
  status: IncidentStatus | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
