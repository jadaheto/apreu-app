import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { PayerData, PayerDirectoryPort } from '../../domain/payer-directory.port.js';

interface PayerRow {
  guardian_document_type: string | null;
  guardian_document_number: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian_address: string | null;
  student_document_type: string | null;
  student_document_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

/** Guardian (`guardians.document_type`) and student (`students.document_type`) codes → DIAN (legacy `dian_tests.php:649-657`). */
const GUARDIAN_ID_TYPES: Record<string, string> = { cc: '13', ti: '12', ce: '22', pa: '41', rc: '11' };
const STUDENT_ID_TYPES: Record<string, string> = { CC: '13', TI: '12', CE: '22', PP: '41', RC: '11' };

/** Read-only query over `students`/`guardians` (students context) to identify who pays. */
@Injectable()
export class SqlPayerDirectory implements PayerDirectoryPort {
  constructor(private readonly db: TenantDataSource) {}

  async findPayerOfStudent(studentId: number): Promise<PayerData | null> {
    const rows: PayerRow[] = await (
      await this.db.manager()
    ).query(
      `SELECT g.document_type AS guardian_document_type, g.document_number AS guardian_document_number,
              g.first_name AS guardian_first_name, g.last_name AS guardian_last_name, g.email AS guardian_email,
              COALESCE(g.mobile, g.phone) AS guardian_phone, g.address AS guardian_address,
              s.document_type AS student_document_type, s.document_number AS student_document_number,
              s.first_name, s.last_name, s.email, s.phone, s.address
         FROM students s LEFT JOIN guardians g ON g.id = s.guardian_id
        WHERE s.id = $1 LIMIT 1`,
      [studentId],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.guardian_document_number && row.guardian_first_name) {
      return {
        name: `${row.guardian_first_name} ${row.guardian_last_name ?? ''}`.trim(),
        firstName: row.guardian_first_name,
        familyName: row.guardian_last_name,
        idType: GUARDIAN_ID_TYPES[row.guardian_document_type ?? 'cc'] ?? '13',
        idNumber: row.guardian_document_number,
        email: row.guardian_email,
        phone: row.guardian_phone,
        address: row.guardian_address,
      };
    }
    if (!row.student_document_number) return null;
    return {
      name: `${row.first_name} ${row.last_name}`.trim(),
      firstName: row.first_name,
      familyName: row.last_name,
      idType: STUDENT_ID_TYPES[row.student_document_type ?? 'TI'] ?? '12',
      idNumber: row.student_document_number,
      email: row.email,
      phone: row.phone,
      address: row.address,
    };
  }
}
