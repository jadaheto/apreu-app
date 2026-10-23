/** Business data the AI flows are allowed to receive (read-only). */
export interface AiContextPort {
  /** `COUNT(*) FROM students WHERE status = 'active'` (marketing CRM data). */
  activeStudentCount(): Promise<number>;
  /**
   * Identity document of the user (student or employee record linked by
   * `user_id`). Legacy bug #17: the payload documented `documento` but never
   * sent it.
   */
  documentNumberOf(userId: number): Promise<string | null>;
}

export const AI_CONTEXT = Symbol('AiContextPort');
