import type { Recipient } from '../email/recipient.js';

/** Guardian reachable by WhatsApp. */
export interface GuardianMobile {
  guardianId: number;
  name: string;
  mobile: string;
}

/**
 * Read-only view of the people that can receive communications. Data is
 * owned by the students and HR contexts; this context only reads it.
 */
export interface RecipientDirectoryPort {
  /**
   * Primary guardians (`students.guardian_id`) of active students with an
   * e-mail (RN-COM-03), optionally restricted to a grade or a classroom.
   */
  guardianEmails(filter: { gradeId?: number; classroomId?: number }): Promise<Recipient[]>;
  /** Active employees with an e-mail. */
  activeEmployeeEmails(): Promise<Recipient[]>;
  /** Distinct primary guardians of active students with a mobile number (RN-COM-10). */
  guardianMobiles(): Promise<GuardianMobile[]>;
  /** Subset of `userIds` that exist and are active. */
  existingUserIds(userIds: readonly number[]): Promise<number[]>;
}

export const RECIPIENT_DIRECTORY = Symbol('RecipientDirectoryPort');
