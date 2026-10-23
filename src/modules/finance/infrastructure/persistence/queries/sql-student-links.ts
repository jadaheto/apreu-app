import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { PortalUser, StudentLinksPort } from '../../../domain/student-links.port.js';

/**
 * Resolves the students linked to a portal user through `students.user_id` /
 * `guardians.user_id` (migration students-001). The e-mail match is only a
 * fallback for records not linked yet (`user_id IS NULL`), so an account can
 * never see students linked to a different account (legacy bug B42).
 */
@Injectable()
export class SqlStudentLinks implements StudentLinksPort {
  constructor(private readonly db: TenantDataSource) {}

  async studentIdsLinkedTo(user: PortalUser): Promise<number[]> {
    const manager = await this.db.manager();
    let rows: { id: number }[] = [];
    if (user.role === 'student') {
      rows = await manager.query(
        `SELECT s.id FROM students s
         WHERE s.user_id = $1
            OR (s.user_id IS NULL AND s.email IS NOT NULL AND s.email <> '' AND LOWER(s.email) = LOWER($2))`,
        [user.userId, user.email],
      );
    } else if (user.role === 'parent') {
      rows = await manager.query(
        `SELECT s.id FROM students s
         INNER JOIN guardians g ON g.id = s.guardian_id
         WHERE g.user_id = $1
            OR (g.user_id IS NULL AND g.email IS NOT NULL AND g.email <> '' AND LOWER(g.email) = LOWER($2))`,
        [user.userId, user.email],
      );
    }
    return rows.map((row) => Number(row.id));
  }
}
