import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AcademicPerformance, AcademicPerformancePort } from '../../domain/academic-performance.port.js';

/** Read-only SQL adapter over `grades_records` (academic context). */
@Injectable()
export class SqlAcademicPerformance implements AcademicPerformancePort {
  constructor(private readonly db: TenantDataSource) {}

  async forYear(studentId: number, academicYear: number): Promise<AcademicPerformance> {
    const [row]: { average: string | null; total: string | number }[] = await (
      await this.db.manager()
    ).query(
      'SELECT AVG(final_score) AS average, COUNT(*)::int AS total FROM grades_records WHERE student_id = $1 AND academic_year = $2',
      [studentId, academicYear],
    );
    return {
      average: row?.average === null || row?.average === undefined ? null : Number(row.average),
      recordCount: Number(row?.total ?? 0),
    };
  }
}
