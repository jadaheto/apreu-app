import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { type AttendanceSource, type AttendanceStatus } from '../../domain/attendance-record.js';

/** Mapping of `attendance_records` (`source` added by migration `academic-001`). */
@Entity({ name: 'attendance_records' })
export class AttendanceRecordOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ name: 'subject_id', type: 'integer', nullable: true })
  subjectId: number | null;

  @Column({ name: 'classroom_id', type: 'integer', nullable: true })
  classroomId: number | null;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'attendance_time', type: 'time' })
  attendanceTime: string;

  @Column({ type: 'varchar', length: 10, default: 'present' })
  status: AttendanceStatus;

  @Column({ type: 'varchar', length: 10, default: 'qr' })
  source: AttendanceSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
