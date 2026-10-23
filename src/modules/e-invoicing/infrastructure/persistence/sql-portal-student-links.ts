import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { PortalStudentLinksPort, PortalUser } from '../../domain/portal-student-links.port.js';

/**
 * Plain SQL over `students`, `guardians` (students context) and `payments`
 * (finance context), so e-invoicing does not depend on other modules. The
 * student/guardian link mirrors `SqlStudentLinks` of finance: `user_id` first,
 * e-mail only for records not linked yet (legacy bug B42).
 */
@Injectable()
export class SqlPortalStudentLinks implements PortalStudentLinksPort {
  constructor(private readonly db: TenantDataSource) {}

  async studentIdsLinkedTo(user: PortalUser): Promise<number[]> {
    let sql: string;
    if (user.role === 'student') {
      sql = `SELECT s.id FROM students s
              WHERE s.user_id = $1
                 OR (s.user_id IS NULL AND s.email IS NOT NULL AND s.email <> '' AND LOWER(s.email) = LOWER($2))`;
    } else if (user.role === 'parent') {
      sql = `SELECT s.id FROM students s
              INNER JOIN guardians g ON g.id = s.guardian_id
              WHERE g.user_id = $1
                 OR (g.user_id IS NULL AND g.email IS NOT NULL AND g.email <> '' AND LOWER(g.email) = LOWER($2))`;
    } else {
      return [];
    }
    return this.ids(sql, [user.userId, user.email]);
  }

  async paymentIdsOfStudent(studentId: number): Promise<number[]> {
    return this.ids('SELECT id FROM payments WHERE student_id = $1', [studentId]);
  }

  private async ids(sql: string, parameters: unknown[]): Promise<number[]> {
    const rows: { id: number | string }[] = await (await this.db.manager()).query(sql, parameters);
    return rows.map((row) => Number(row.id));
  }
}
