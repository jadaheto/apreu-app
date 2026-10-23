import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `employee_leaves` (baseline + migration hr-001). */
@Entity({ name: 'employee_leaves' })
export class LeaveRequestOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ name: 'leave_type', type: 'varchar', length: 30 })
  leaveType: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'pending' })
  status: string | null;

  @Column({ name: 'requested_by', type: 'integer', nullable: true })
  requestedBy: number | null;

  @Column({ name: 'decided_by', type: 'integer', nullable: true })
  decidedBy: number | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'varchar', length: 255, nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
