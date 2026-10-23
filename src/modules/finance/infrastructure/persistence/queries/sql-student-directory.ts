import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { BillingStudent, StudentDirectoryPort } from '../../../domain/student-directory.port.js';
import { unaccentLike } from '../../../../../shared/infrastructure/persistence/sql.js';
import { likePattern, num } from '../sql.js';

interface StudentRow {
  id: number;
  code: string;
  fullName: string;
  documentNumber: string | null;
  status: string;
  gradeId: number | null;
  gradeName: string | null;
  classroomName: string | null;
  scholarshipPct: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

const SELECT_STUDENTS = `
  SELECT s.id, s.code, concat_ws(' ', s.first_name, s.last_name) AS "fullName", s.document_number AS "documentNumber",
         s.status, cl.grade_id AS "gradeId", g.name AS "gradeName", cl.name AS "classroomName",
         s.scholarship_pct AS "scholarshipPct",
         CASE WHEN gu.id IS NULL THEN NULL ELSE concat_ws(' ', gu.first_name, gu.last_name) END AS "guardianName",
         COALESCE(gu.mobile, gu.phone) AS "guardianPhone"
  FROM students s
  LEFT JOIN classrooms cl ON cl.id = s.classroom_id
  LEFT JOIN grades g ON g.id = cl.grade_id
  LEFT JOIN guardians gu ON gu.id = s.guardian_id`;

const toStudent = (row: StudentRow): BillingStudent => ({
  id: Number(row.id),
  code: row.code,
  fullName: row.fullName,
  documentNumber: row.documentNumber,
  status: row.status,
  gradeId: row.gradeId === null ? null : Number(row.gradeId),
  gradeName: row.gradeName,
  classroomName: row.classroomName,
  scholarshipPct: num(row.scholarshipPct),
  guardianName: row.guardianName,
  guardianPhone: row.guardianPhone,
});

/** Read-only adapter over the students/academic tables (no coupling to their ORM entities). */
@Injectable()
export class SqlStudentDirectory implements StudentDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<BillingStudent | null> {
    const rows: StudentRow[] = await (await this.db.manager()).query(`${SELECT_STUDENTS} WHERE s.id = $1`, [id]);
    return rows[0] ? toStudent(rows[0]) : null;
  }

  async findActive({ gradeId }: { gradeId?: number }): Promise<BillingStudent[]> {
    const rows: StudentRow[] = await (
      await this.db.manager()
    ).query(
      `${SELECT_STUDENTS} WHERE s.status = 'active' ${gradeId ? 'AND cl.grade_id = $1' : ''}
       ORDER BY s.last_name, s.first_name`,
      gradeId ? [gradeId] : [],
    );
    return rows.map(toStudent);
  }

  async search(term: string, limit: number): Promise<BillingStudent[]> {
    const like = likePattern(term);
    const rows: StudentRow[] = await (
      await this.db.manager()
    ).query(
      `${SELECT_STUDENTS}
       WHERE s.status = 'active'
         AND (${unaccentLike("s.first_name || ' ' || s.last_name", 1)} OR ${unaccentLike('s.code', 1)} OR ${unaccentLike('s.document_number', 1)})
       ORDER BY s.last_name, s.first_name
       LIMIT $2`,
      [like, limit],
    );
    return rows.map(toStudent);
  }
}
