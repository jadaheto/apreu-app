import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ClassroomDirectoryPort, ClassroomInfo } from '../../domain/classroom-directory.port.js';

interface ClassroomRow {
  id: number;
  name: string;
  grade_id: number;
  academic_year: number | string;
  grade_name: string;
  grade_level: string;
}

/** Read-only SQL adapter over the academic context's `classrooms` and `grades`. */
@Injectable()
export class SqlClassroomDirectory implements ClassroomDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<ClassroomInfo | null> {
    return (await this.findByIds([id]))[0] ?? null;
  }

  async findByIds(ids: number[]): Promise<ClassroomInfo[]> {
    if (ids.length === 0) return [];
    const rows: ClassroomRow[] = await (
      await this.db.manager()
    ).query(
      `SELECT c.id, c.name, c.grade_id, c.academic_year, g.name AS grade_name, g.level AS grade_level
       FROM classrooms c JOIN grades g ON g.id = c.grade_id
       WHERE c.id = ANY($1)`,
      [ids],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      gradeId: Number(row.grade_id),
      gradeName: row.grade_name,
      gradeLevel: row.grade_level,
      academicYear: Number(row.academic_year),
    }));
  }
}
