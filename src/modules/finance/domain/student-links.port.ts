/** Portal user whose linked students must be resolved. */
export interface PortalUser {
  userId: number;
  email: string;
  role: string;
}

/**
 * Students a portal user may see: a student sees itself and a guardian sees
 * the students in their care (linked by `user_id`, e-mail as fallback).
 */
export interface StudentLinksPort {
  studentIdsLinkedTo(user: PortalUser): Promise<number[]>;
}

export const STUDENT_LINKS = Symbol('StudentLinksPort');
