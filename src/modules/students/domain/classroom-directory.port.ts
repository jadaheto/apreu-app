/** Classroom with its grade, as read from the academic context (`classrooms` + `grades`). */
export interface ClassroomInfo {
  id: number;
  name: string;
  gradeId: number;
  gradeName: string;
  /** `grades.level`: preescolar, primaria, secundaria, media… */
  gradeLevel: string;
  academicYear: number;
}

/** Read-only port over the academic context's classrooms. */
export interface ClassroomDirectoryPort {
  findById(id: number): Promise<ClassroomInfo | null>;
  findByIds(ids: number[]): Promise<ClassroomInfo[]>;
}

export const CLASSROOM_DIRECTORY = Symbol('ClassroomDirectoryPort');
