/** Student plus the users and guardian to notify. */
export interface StudentContact {
  studentId: number;
  fullName: string;
  /** Portal user of the student, if any. */
  userId: number | null;
  guardianName: string | null;
  guardianEmail: string | null;
}

/** Read-only access to students/guardians and academic periods. */
export interface StudentContactsPort {
  contacts(studentIds: readonly number[]): Promise<StudentContact[]>;
  periodName(periodId: number): Promise<string | null>;
}

export const STUDENT_CONTACTS = Symbol('StudentContactsPort');
