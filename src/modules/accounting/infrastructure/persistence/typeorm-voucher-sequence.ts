import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { VoucherSequencePort } from '../../application/ports/voucher-sequence.port.js';
import { formatVoucherNumber, type VoucherType } from '../../domain/voucher-type.js';

/**
 * Seeds the row of a type from the highest numeric number already posted, only
 * the first time (the `NOT EXISTS` gate avoids scanning the journal afterwards).
 * Non-numeric numbers (drafts, legacy text) are ignored instead of failing the cast.
 */
const SEED_SQL = `
  INSERT INTO accounting_sequences (entry_type, last_number)
  SELECT $1::varchar, COALESCE(MAX(CASE WHEN entry_number ~ '^[0-9]{1,9}$' THEN entry_number::int END), 0)
    FROM accounting_journal_entries
   WHERE entry_type = $1::varchar AND status <> 'draft'
     AND NOT EXISTS (SELECT 1 FROM accounting_sequences WHERE entry_type = $1::varchar)
  ON CONFLICT (entry_type) DO NOTHING`;

/** Atomic increment: the upsert takes the row lock until the caller's transaction ends. */
const INCREMENT_SQL = `
  INSERT INTO accounting_sequences AS s (entry_type, last_number) VALUES ($1, 1)
  ON CONFLICT (entry_type) DO UPDATE SET last_number = s.last_number + 1
  RETURNING s.last_number AS "lastNumber"`;

/**
 * Consecutives in `accounting_sequences` (bug 6). The increment is a single
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING`, which locks the row of the
 * type until the caller's transaction commits: concurrent postings wait, and a
 * rollback gives the number back, so the sequence has no gaps. Must run inside
 * the caller's transaction.
 */
@Injectable()
export class TypeOrmVoucherSequence implements VoucherSequencePort {
  constructor(private readonly db: TenantDataSource) {}

  async next(type: VoucherType): Promise<string> {
    const manager = await this.db.manager();
    await manager.query(SEED_SQL, [type]);
    const rows: { lastNumber: number | string }[] = await manager.query(INCREMENT_SQL, [type]);
    return formatVoucherNumber(Number(rows[0].lastNumber));
  }
}
