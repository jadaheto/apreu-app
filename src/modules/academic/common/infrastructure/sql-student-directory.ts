import { Injectable } from '@nestjs/common';
import { Role } from '../../../../shared/domain/role.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  StudentDirectoryPort,
  StudentGender,
  StudentPortalUser,
  StudentSummary,
} from '../domain/student-directory.port.js';

interface StudentRow {
  id: number | string;
  code: string;
  first_name: string;
  last_name: string;
  document_type: string | null;
  document_number: string | null;
  gender: StudentGender | null;
  phone: string | null;
  classroom_id: number | string | null;
  status: string;
}

const COLUMNS = 'id, code, first_name, last_name, document_type, document_number, gender, phone, classroom_id, status';

const toSummary = (row: StudentRow): StudentSummary => ({
  id: Number(row.id),
  code: row.code,
  firstName: row.first_name,
  lastName: row.last_name,
  documentType: row.document_type,
  documentNumber: row.document_number,
  gender: row.gender ?? 'O',
  phone: row.phone,
  classroomId: row.classroom_id === null ? null : Number(row.classroom_id),
  isActive: row.status === 'active',
});

/**
 * Reads the `students` / `guardians` tables (students context) with plain SQL,
 * so the academic module does not depend on another context's ORM entities.
 */
@Injectable()
export class SqlStudentDirectory implements StudentDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<StudentSummary | null> {
    const rows = await this.query<StudentRow>(`SELECT ${COLUMNS} FROM students WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? toSummary(rows[0]) : null;
  }

  async findByIds(ids: readonly number[]): Promise<StudentSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.query<StudentRow>(`SELECT ${COLUMNS} FROM students WHERE id = ANY($1)`, [[...ids]]);
    return rows.map(toSummary);
  }

  async listActiveByClassroom(classroomId: number): Promise<StudentSummary[]> {
    const rows = await this.query<StudentRow>(
      `SELECT ${COLUMNS} FROM students WHERE classroom_id = $1 AND status = 'active' ORDER BY last_name, first_name`,
      [classroomId],
    );
    return rows.map(toSummary);
  }

  async countActiveByClassroom(classroomIds: readonly number[]): Promise<Map<number, number>> {
    if (classroomIds.length === 0) return new Map();
    const rows = await this.query<{ classroom_id: number | string; total: number | string }>(
      `SELECT classroom_id, COUNT(*)::int AS total FROM students
        WHERE status = 'active' AND classroom_id = ANY($1) GROUP BY classroom_id`,
      [[...classroomIds]],
    );
    return new Map(rows.map((row) => [Number(row.classroom_id), Number(row.total)]));
  }

  async linkedStudentIds(user: StudentPortalUser): Promise<number[]> {
    if (user.role === Role.STUDENT) {
      // Legacy `student/index.php`: link by user_id first, e-mail only as a fallback.
      const byUser = await this.query<{ id: number }>('SELECT id FROM students WHERE user_id = $1', [user.userId]);
      if (byUser.length > 0) return byUser.map((row) => Number(row.id));
      const byEmail = await this.query<{ id: number }>(
        "SELECT id FROM students WHERE lower(email) = lower($1) AND email <> '' LIMIT 1",
        [user.email],
      );
      return byEmail.map((row) => Number(row.id));
    }
    if (user.role === Role.PARENT) {
      // `guardians.user_id` comes from migration students-001; e-mail is the legacy fallback.
      const rows = await this.query<{ id: number }>(
        `SELECT DISTINCT s.id FROM students s JOIN guardians g ON g.id = s.guardian_id
          WHERE g.user_id = $1 OR (g.user_id IS NULL AND lower(g.email) = lower($2) AND g.email <> '')`,
        [user.userId, user.email],
      );
      return rows.map((row) => Number(row.id));
    }
    return [];
  }

  private async query<T>(sql: string, params: unknown[]): Promise<T[]> {
    return (await this.db.manager()).query(sql, params);
  }
}
