import { Injectable } from '@nestjs/common';
import { queryReturning } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { StudentCode } from '../../domain/student-code.js';
import type { StudentCodeSequencePort } from '../../domain/student-code-sequence.port.js';

/**
 * Per-year counter in `student_code_sequences` (migration `students-001`).
 * The first use of a year seeds the counter with the highest existing
 * sequence of that year (`ON CONFLICT DO NOTHING`); the atomic
 * `UPDATE … RETURNING` locks the row until the enclosing transaction ends, so
 * concurrent enrollments are serialized.
 */
@Injectable()
export class SqlStudentCodeSequence implements StudentCodeSequencePort {
  constructor(private readonly db: TenantDataSource) {}

  next(year: number): Promise<number> {
    return this.db.runInTransaction(async () => {
      const manager = await this.db.manager();
      const prefix = `${StudentCode.PREFIX}${year}`;
      await manager.query(
        `INSERT INTO student_code_sequences (year, last_value)
         SELECT $1::smallint, COALESCE(MAX(substring(code FROM $2::int)::bigint), 0)
         FROM students WHERE code ~ $3
         ON CONFLICT (year) DO NOTHING`,
        [year, prefix.length + 1, `^${prefix}[0-9]{1,9}$`],
      );
      const rows = await queryReturning<{ last_value: number | string }>(
        manager,
        'UPDATE student_code_sequences SET last_value = last_value + 1 WHERE year = $1 RETURNING last_value',
        [year],
      );
      return Number(rows[0].last_value);
    });
  }
}
