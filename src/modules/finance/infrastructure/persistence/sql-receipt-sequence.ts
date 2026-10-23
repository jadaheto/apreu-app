import { Injectable } from '@nestjs/common';
import { queryReturning } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ReceiptSequencePort } from '../../domain/receipt-sequence.port.js';
import { num } from './sql.js';

/**
 * Receipt counter stored in `finance_receipt_sequences` (migration
 * `finance-001`), one row per (prefix, year).
 *
 * The row is created on first use (`ON CONFLICT DO NOTHING`), seeded with the
 * highest number already issued for that prefix and year (legacy receipts keep
 * their numbers), then incremented atomically with `UPDATE … RETURNING` in the
 * caller's transaction. The updated row stays locked until commit, so two
 * cashiers can never obtain the same number, and a rollback releases the
 * number (no gaps).
 */
@Injectable()
export class SqlReceiptSequence implements ReceiptSequencePort {
  constructor(private readonly db: TenantDataSource) {}

  async next(prefix: string, year: number): Promise<number> {
    const manager = await this.db.manager();
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('El consecutivo de recibos debe obtenerse dentro de una transacción.');
    }
    const head = `${prefix}-${year}-`;
    await manager.query(
      `INSERT INTO finance_receipt_sequences (prefix, year, last_number)
       SELECT $1::varchar, $2::smallint, COALESCE(MAX(substring(receipt_no FROM $3::int)::bigint), 0)
       FROM payments
       WHERE receipt_no LIKE $4 AND substring(receipt_no FROM $3::int) ~ '^[0-9]{1,9}$'
       ON CONFLICT (prefix, year) DO NOTHING`,
      [prefix, year, head.length + 1, `${head}%`],
    );
    const rows = await queryReturning<{ last_number: number }>(
      manager,
      `UPDATE finance_receipt_sequences SET last_number = last_number + 1
       WHERE prefix = $1 AND year = $2
       RETURNING last_number`,
      [prefix, year],
    );
    return num(rows[0]?.last_number);
  }
}
