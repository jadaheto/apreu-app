import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { StaffDirectoryPort, StaffMember } from '../domain/staff-directory.port.js';

interface EmployeeRow {
  id: number | string;
  code: string;
  first_name: string;
  last_name: string;
  employee_type: string | null;
  status: string | null;
}

const COLUMNS = 'id, code, first_name, last_name, employee_type, status';

const toMember = (row: EmployeeRow): StaffMember => ({
  id: Number(row.id),
  code: row.code,
  firstName: row.first_name,
  lastName: row.last_name,
  employeeType: row.employee_type ?? 'otro',
  status: row.status ?? 'inactive',
});

/** Reads `employees` (HR context) with plain SQL; never writes. */
@Injectable()
export class SqlStaffDirectory implements StaffDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<StaffMember | null> {
    const rows = await this.query(`SELECT ${COLUMNS} FROM employees WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? toMember(rows[0]) : null;
  }

  async findByIds(ids: readonly number[]): Promise<StaffMember[]> {
    if (ids.length === 0) return [];
    return (await this.query(`SELECT ${COLUMNS} FROM employees WHERE id = ANY($1)`, [[...ids]])).map(toMember);
  }

  async findByUser(userId: number, email: string): Promise<StaffMember | null> {
    const rows = await this.query(
      `SELECT ${COLUMNS} FROM employees WHERE user_id = $1 OR (lower(email) = lower($2) AND email <> '')
        ORDER BY (user_id = $1) IS TRUE DESC LIMIT 1`,
      [userId, email],
    );
    return rows[0] ? toMember(rows[0]) : null;
  }

  async listTeachingStaff(): Promise<StaffMember[]> {
    const rows = await this.query(
      `SELECT ${COLUMNS} FROM employees
        WHERE status = 'active' AND employee_type IN ('docente', 'directivo')
        ORDER BY first_name, last_name`,
      [],
    );
    return rows.map(toMember);
  }

  private async query(sql: string, params: unknown[]): Promise<EmployeeRow[]> {
    return (await this.db.manager()).query(sql, params);
  }
}
