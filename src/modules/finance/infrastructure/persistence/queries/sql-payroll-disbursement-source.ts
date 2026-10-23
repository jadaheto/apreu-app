import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  DisbursementLine,
  PayrollDisbursementSourcePort,
  PayrollPeriodInfo,
} from '../../../domain/payroll-disbursement-source.port.js';
import { num } from '../sql.js';

/** Reads `payroll_periods`, `payroll_payments` and `employees` (HR context). */
@Injectable()
export class SqlPayrollDisbursementSource implements PayrollDisbursementSourcePort {
  constructor(private readonly db: TenantDataSource) {}

  async findPeriod(id: number): Promise<PayrollPeriodInfo | null> {
    const rows: { id: number; name: string; status: string }[] = await (
      await this.db.manager()
    ).query('SELECT id, name, status FROM payroll_periods WHERE id = $1', [id]);
    return rows[0] ? { id: Number(rows[0].id), name: rows[0].name, status: rows[0].status } : null;
  }

  async linesOf(periodId: number): Promise<DisbursementLine[]> {
    const rows: {
      documentNumber: string;
      fullName: string;
      bankAccount: string | null;
      accountType: string | null;
      netSalary: string;
    }[] = await (
      await this.db.manager()
    ).query(
      `SELECT e.document_number AS "documentNumber", concat_ws(' ', e.first_name, e.last_name) AS "fullName",
              e.bank_account AS "bankAccount", e.account_type AS "accountType", pp.net_salary AS "netSalary"
       FROM payroll_payments pp
       INNER JOIN employees e ON e.id = pp.employee_id
       WHERE pp.payroll_period_id = $1 AND pp.net_salary > 0 AND COALESCE(pp.status, 'pending') <> 'cancelled'
       ORDER BY e.last_name, e.first_name`,
      [periodId],
    );
    return rows.map((row) => ({ ...row, netSalary: num(row.netSalary) }));
  }
}
