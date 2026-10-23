/** Average of the final scores of a year (scale 0-5). */
export interface AcademicPerformance {
  average: number | null;
  recordCount: number;
}

/** Read-only port over the academic context's grade records (`grades_records`). */
export interface AcademicPerformancePort {
  forYear(studentId: number, academicYear: number): Promise<AcademicPerformance>;
}

export const ACADEMIC_PERFORMANCE = Symbol('AcademicPerformancePort');
