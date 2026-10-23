import type { BillingPeriod } from './billing-period.vo.js';
import type { StudentCharge } from './student-charge.js';

export interface LockOptions {
  /** Lock the rows until the current transaction ends (`SELECT … FOR UPDATE`). */
  forUpdate?: boolean;
}

/** Output port for {@link StudentCharge} persistence. Loaded charges carry their paid amount. */
export interface StudentChargeRepository {
  findById(id: number, options?: LockOptions): Promise<StudentCharge | null>;
  findByIds(ids: number[], options?: LockOptions): Promise<StudentCharge[]>;
  /** Every charge of the student ordered by due date and id. */
  findByStudent(studentId: number): Promise<StudentCharge[]>;
  /** Open charges with balance, oldest first (FIFO by due date, id). */
  findOpenByStudent(studentId: number, options?: LockOptions): Promise<StudentCharge[]>;
  /** Students (among the given ones) that already have a non-cancelled charge of the concept in the period. */
  studentsAlreadyCharged(conceptId: number, period: BillingPeriod, studentIds: number[]): Promise<Set<number>>;
  save(charge: StudentCharge): Promise<void>;
  saveMany(charges: StudentCharge[]): Promise<void>;
}

export const STUDENT_CHARGE_REPOSITORY = Symbol('StudentChargeRepository');
