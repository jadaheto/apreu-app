/** Group directors (`group_directors`, academic context), read-only. */
export interface GroupDirectorPort {
  /** True when the user is the active director of the classroom. */
  isActiveDirector(userId: number, classroomId: number): Promise<boolean>;
}

export const GROUP_DIRECTORS = Symbol('GroupDirectorPort');
