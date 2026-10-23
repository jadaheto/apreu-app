import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { JournalLine } from '../domain/journal-line.js';
import type { VoucherType } from '../domain/voucher-type.js';

/** Line as received from the HTTP layer (amounts in pesos). */
export interface JournalLineInput {
  accountId: number;
  thirdPartyId?: number | null;
  description?: string | null;
  debit?: number;
  credit?: number;
}

/** Header and lines of a manual entry. */
export interface JournalEntryInput {
  /** Inferred from the date (open period containing it) when omitted. */
  periodId?: number;
  date: string;
  type: VoucherType;
  description: string;
  lines: JournalLineInput[];
}

export const toJournalLines = (lines: readonly JournalLineInput[]): JournalLine[] =>
  lines.map((line) =>
    JournalLine.create({
      accountId: line.accountId,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description ?? null,
      debit: Money.of(line.debit ?? 0),
      credit: Money.of(line.credit ?? 0),
    }),
  );
