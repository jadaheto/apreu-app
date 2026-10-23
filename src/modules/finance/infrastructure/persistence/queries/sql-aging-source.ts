import { Injectable } from '@nestjs/common';
import { Money } from '../../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AgingSourcePort } from '../../../application/ports/aging-source.port.js';
import type { OverdueCharge } from '../../../domain/aging.js';
import { OPEN_STATUSES_SQL, PAID_BY_CHARGE } from '../sql.js';

/** Overdue open charges with balance; the grade filter is a real WHERE condition (bug B24). */
@Injectable()
export class SqlAgingSource implements AgingSourcePort {
  constructor(private readonly db: TenantDataSource) {}

  async overdueCharges({ today, gradeId }: { today: string; gradeId?: number }): Promise<OverdueCharge[]> {
    const rows: Record<string, any>[] = await (
      await this.db.manager()
    ).query(
      `SELECT sc.student_id AS "studentId", concat_ws(' ', s.first_name, s.last_name) AS "studentName", s.code AS "studentCode",
              cl.grade_id AS "gradeId", g.name AS "gradeName", cl.name AS "classroomName",
              to_char(sc.due_date, 'YYYY-MM-DD') AS "dueDate", sc.net_amount - COALESCE(pd.paid, 0) AS pending
       FROM student_charges sc
       INNER JOIN students s ON s.id = sc.student_id
       LEFT JOIN classrooms cl ON cl.id = s.classroom_id
       LEFT JOIN grades g ON g.id = cl.grade_id
       LEFT JOIN ${PAID_BY_CHARGE} pd ON pd.charge_id = sc.id
       WHERE sc.status IN ${OPEN_STATUSES_SQL} AND sc.due_date < $1
         AND sc.net_amount - COALESCE(pd.paid, 0) > 0
         ${gradeId ? 'AND cl.grade_id = $2' : ''}`,
      gradeId ? [today, gradeId] : [today],
    );
    return rows.map((row) => ({
      studentId: Number(row.studentId),
      studentName: row.studentName,
      studentCode: row.studentCode,
      gradeId: row.gradeId === null ? null : Number(row.gradeId),
      gradeName: row.gradeName ?? null,
      classroomName: row.classroomName ?? null,
      dueDate: row.dueDate,
      pending: Money.of(row.pending),
    }));
  }
}
