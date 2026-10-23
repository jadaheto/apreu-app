import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AiContextPort } from '../../domain/directory/ai-context.port.js';
import type {
  BillingChargesPort,
  ChargeNotice,
  PendingChargesFilter,
} from '../../domain/directory/billing-charges.port.js';
import type { GroupDirectorPort } from '../../domain/directory/group-director.port.js';
import type { ElectronicInvoiceData, InvoiceLookupPort } from '../../domain/directory/invoice-lookup.port.js';
import type { PaymentConfirmationData, PaymentLookupPort } from '../../domain/directory/payment-lookup.port.js';
import type { GuardianMobile, RecipientDirectoryPort } from '../../domain/directory/recipient-directory.port.js';
import type { StudentContact, StudentContactsPort } from '../../domain/directory/student-contacts.port.js';
import type { Recipient } from '../../domain/email/recipient.js';

/*
 * Read-only SQL adapters over tables owned by other contexts (students,
 * HR, academic, finance, e-invoicing). Plain queries avoid importing their
 * ORM entities (guide rule 7, see identity's SqlEmploymentStatus).
 */

const FULL_NAME = (alias: string) => `TRIM(CONCAT(${alias}.first_name, ' ', ${alias}.last_name))`;

@Injectable()
export class SqlRecipientDirectory implements RecipientDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async guardianEmails(filter: { gradeId?: number; classroomId?: number }): Promise<Recipient[]> {
    const params: number[] = [];
    let sql = `SELECT DISTINCT g.email AS email, ${FULL_NAME('g')} AS name
                 FROM guardians g
                 JOIN students s ON s.guardian_id = g.id`;
    if (filter.gradeId !== undefined) {
      params.push(filter.gradeId);
      sql += ` JOIN classrooms cl ON cl.id = s.classroom_id AND cl.grade_id = $${params.length}`;
    }
    sql += " WHERE s.status = 'active' AND g.email IS NOT NULL AND g.email <> ''";
    if (filter.classroomId !== undefined) {
      params.push(filter.classroomId);
      sql += ` AND s.classroom_id = $${params.length}`;
    }
    return (await this.db.manager()).query(sql, params);
  }

  async activeEmployeeEmails(): Promise<Recipient[]> {
    return (await this.db.manager()).query(
      `SELECT DISTINCT email, ${FULL_NAME('e')} AS name
         FROM employees e
        WHERE e.status = 'active' AND e.email IS NOT NULL AND e.email <> ''`,
    );
  }

  async guardianMobiles(): Promise<GuardianMobile[]> {
    const rows: { id: number; name: string; mobile: string }[] = await (
      await this.db.manager()
    ).query(
      `SELECT g.id, ${FULL_NAME('g')} AS name, g.mobile
         FROM guardians g
        WHERE g.mobile IS NOT NULL AND g.mobile <> ''
          AND EXISTS (SELECT 1 FROM students s WHERE s.guardian_id = g.id AND s.status = 'active')
        ORDER BY g.id`,
    );
    return rows.map((row) => ({ guardianId: Number(row.id), name: row.name, mobile: row.mobile }));
  }

  async existingUserIds(userIds: readonly number[]): Promise<number[]> {
    if (userIds.length === 0) return [];
    const rows: { id: number }[] = await (
      await this.db.manager()
    ).query('SELECT id FROM users WHERE is_active = true AND id = ANY($1::int[])', [userIds]);
    return rows.map((row) => Number(row.id));
  }
}

@Injectable()
export class SqlGroupDirectors implements GroupDirectorPort {
  constructor(private readonly db: TenantDataSource) {}

  async isActiveDirector(userId: number, classroomId: number): Promise<boolean> {
    const rows: unknown[] = await (
      await this.db.manager()
    ).query(
      `SELECT 1 FROM group_directors gd
         JOIN employees e ON e.id = gd.employee_id
        WHERE gd.classroom_id = $1 AND gd.is_active = true AND e.user_id = $2
        LIMIT 1`,
      [classroomId, userId],
    );
    return rows.length > 0;
  }
}

@Injectable()
export class SqlBillingCharges implements BillingChargesPort {
  constructor(private readonly db: TenantDataSource) {}

  async pendingCharges(filter: PendingChargesFilter): Promise<ChargeNotice[]> {
    const params: (string | number)[] = [filter.from, filter.to];
    let sql = `SELECT sc.id AS "chargeId", sc.student_id AS "studentId", ${FULL_NAME('s')} AS "studentName",
                      s.code AS "studentCode", bc.name AS "conceptName", sc.net_amount AS "netAmount",
                      to_char(sc.due_date, 'YYYY-MM-DD') AS "dueDate",
                      ${FULL_NAME('g')} AS "guardianName", g.email AS "guardianEmail", g.mobile AS "guardianMobile"
                 FROM student_charges sc
                 JOIN students s ON s.id = sc.student_id
                 LEFT JOIN guardians g ON g.id = s.guardian_id
                 LEFT JOIN billing_concepts bc ON bc.id = sc.concept_id
                WHERE sc.status = 'pending' AND sc.due_date BETWEEN $1 AND $2`;
    if (filter.conceptId) {
      params.push(filter.conceptId);
      sql += ` AND sc.concept_id = $${params.length}`;
    }
    sql += ' ORDER BY s.last_name, s.first_name, sc.due_date, sc.id';
    const rows: ChargeNotice[] = await (await this.db.manager()).query(sql, params);
    return rows.map((row) => ({
      ...row,
      chargeId: Number(row.chargeId),
      studentId: Number(row.studentId),
      netAmount: Number(row.netAmount),
      guardianEmail: row.guardianEmail?.trim() || null,
      guardianMobile: row.guardianMobile?.trim() || null,
    }));
  }
}

@Injectable()
export class SqlPaymentLookup implements PaymentLookupPort {
  constructor(private readonly db: TenantDataSource) {}

  async findForConfirmation(paymentId: number): Promise<PaymentConfirmationData | null> {
    const [row]: Record<string, string | number | null>[] = await (
      await this.db.manager()
    ).query(
      `SELECT p.id, p.receipt_no, p.amount, p.student_id, ${FULL_NAME('s')} AS student_name,
              ${FULL_NAME('g')} AS guardian_name, g.mobile AS guardian_mobile
         FROM payments p
         JOIN students s ON s.id = p.student_id
         LEFT JOIN guardians g ON g.id = s.guardian_id
        WHERE p.id = $1
        LIMIT 1`,
      [paymentId],
    );
    if (!row) return null;
    return {
      paymentId: Number(row.id),
      receiptNumber: (row.receipt_no as string | null) || null,
      amount: Number(row.amount),
      studentId: Number(row.student_id),
      studentName: String(row.student_name),
      guardianName: (row.guardian_name as string | null) || null,
      guardianMobile: (row.guardian_mobile as string | null)?.trim() || null,
    };
  }
}

@Injectable()
export class SqlInvoiceLookup implements InvoiceLookupPort {
  constructor(private readonly db: TenantDataSource) {}

  async findById(dianInvoiceId: number): Promise<ElectronicInvoiceData | null> {
    const [row]: Record<string, string | number | null>[] = await (
      await this.db.manager()
    ).query(
      `SELECT id, invoice_number, cufe, customer_name, customer_email, total,
              to_char(issue_date, 'YYYY-MM-DD') AS issue_date, xml_content
         FROM dian_invoices
        WHERE id = $1
        LIMIT 1`,
      [dianInvoiceId],
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      number: String(row.invoice_number),
      cufe: (row.cufe as string | null) || null,
      customerName: String(row.customer_name),
      customerEmail: (row.customer_email as string | null)?.trim() || null,
      total: Number(row.total),
      issueDate: String(row.issue_date),
      xmlContent: (row.xml_content as string | null) || null,
    };
  }
}

@Injectable()
export class SqlStudentContacts implements StudentContactsPort {
  constructor(private readonly db: TenantDataSource) {}

  async contacts(studentIds: readonly number[]): Promise<StudentContact[]> {
    if (studentIds.length === 0) return [];
    const rows: Record<string, string | number | null>[] = await (
      await this.db.manager()
    ).query(
      `SELECT s.id, ${FULL_NAME('s')} AS full_name, s.user_id, ${FULL_NAME('g')} AS guardian_name, g.email AS guardian_email
         FROM students s
         LEFT JOIN guardians g ON g.id = s.guardian_id
        WHERE s.id = ANY($1::int[])`,
      [studentIds],
    );
    return rows.map((row) => ({
      studentId: Number(row.id),
      fullName: String(row.full_name),
      userId: row.user_id === null ? null : Number(row.user_id),
      guardianName: (row.guardian_name as string | null) || null,
      guardianEmail: (row.guardian_email as string | null)?.trim() || null,
    }));
  }

  async periodName(periodId: number): Promise<string | null> {
    const [row]: { name: string }[] = await (
      await this.db.manager()
    ).query('SELECT name FROM academic_periods WHERE id = $1 LIMIT 1', [periodId]);
    return row?.name ?? null;
  }
}

@Injectable()
export class SqlAiContext implements AiContextPort {
  constructor(private readonly db: TenantDataSource) {}

  async activeStudentCount(): Promise<number> {
    const [row]: { total: string | number }[] = await (
      await this.db.manager()
    ).query("SELECT COUNT(*)::int AS total FROM students WHERE status = 'active'");
    return Number(row?.total ?? 0);
  }

  async documentNumberOf(userId: number): Promise<string | null> {
    const [row]: { document_number: string }[] = await (
      await this.db.manager()
    ).query(
      `SELECT document_number FROM (
          SELECT document_number FROM students WHERE user_id = $1 AND document_number IS NOT NULL AND document_number <> ''
          UNION ALL
          SELECT document_number FROM employees WHERE user_id = $1
       ) AS documents
       LIMIT 1`,
      [userId],
    );
    return row?.document_number ?? null;
  }
}
