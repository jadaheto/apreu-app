import type { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { BANK_FILE_EOL, FixedWidth } from './fixed-width.js';

export interface CollectionEntry {
  /** Payer reference (student document, or student id when it has none). */
  reference: string;
  amount: Money;
}

/**
 * Student collection flat file, layout documented in analysis §2.7-B:
 *
 * - Header `01` (27): NIT(10, zeros) "RECAUDO MES"(15).
 * - Detail `02` (48): reference(20, zeros) amount(14, zeros) date YYYYMMDD(8) authorization "0000"(4).
 * - Control `03` (29): records(9) total(18).
 *
 * Amounts are whole pesos of the real pending balance (with taxes, minus
 * payments), one line per student (legacy used the base amount and repeated
 * references, bugs B33/B34).
 */
export const CollectionFile = {
  build(input: { nit: string; date: string; entries: CollectionEntry[] }): string {
    const amounts = input.entries.map((entry) => Math.round(entry.amount.amount));
    const date = input.date.replace(/-/g, '');
    const header = '01' + FixedWidth.number(input.nit, 10, 'NIT') + FixedWidth.text('RECAUDO MES', 15);
    const details = input.entries.map(
      (entry, index) =>
        '02' +
        FixedWidth.number(entry.reference, 20, 'referencia') +
        FixedWidth.number(amounts[index], 14, 'valor') +
        date +
        '0000',
    );
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const control = '03' + FixedWidth.number(details.length, 9, 'registros') + FixedWidth.number(total, 18, 'total');
    return [header, ...details, control].join(BANK_FILE_EOL) + BANK_FILE_EOL;
  },
};
