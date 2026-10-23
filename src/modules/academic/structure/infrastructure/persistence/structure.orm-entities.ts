import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mapping of `grades`. */
@Entity({ name: 'grades' })
export class GradeOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30, default: 'primaria' })
  level: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `subjects` (`credits` is unused and keeps its default). */
@Entity({ name: 'subjects' })
export class SubjectOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area: string | null;

  @Column({ name: 'grade_id', type: 'integer' })
  gradeId: number;

  @Column({ name: 'hours_per_week', type: 'smallint', default: 1 })
  hoursPerWeek: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `classrooms`. */
@Entity({ name: 'classrooms' })
export class ClassroomOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'grade_id', type: 'integer' })
  gradeId: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'smallint', default: 30 })
  capacity: number;

  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/** Mapping of `teacher_assignments`. */
@Entity({ name: 'teacher_assignments' })
export class TeacherAssignmentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ name: 'subject_id', type: 'integer' })
  subjectId: number;

  @Column({ name: 'classroom_id', type: 'integer' })
  classroomId: number;

  @Column({ name: 'academic_year', type: 'integer' })
  academicYear: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}

/**
 * Mapping of `group_directors`. The generated column `active_classroom_id`
 * (migration `academic-001`) is intentionally not mapped.
 */
@Entity({ name: 'group_directors' })
export class GroupDirectorOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ name: 'classroom_id', type: 'integer' })
  classroomId: number;

  @Column({ name: 'assignment_date', type: 'date', nullable: true })
  assignmentDate: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
