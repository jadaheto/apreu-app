/** Banks offered for the payroll disbursement file (legacy `finance/bank_files.php`). */
export const PAYROLL_FILE_BANKS = ['bancolombia', 'davivienda', 'bogota'] as const;
export type PayrollFileBank = (typeof PAYROLL_FILE_BANKS)[number];

/** Formats offered for the collection file. */
export const COLLECTION_FILE_BANKS = ['asobancaria', 'bancolombia_pab'] as const;
export type CollectionFileBank = (typeof COLLECTION_FILE_BANKS)[number];

/** A generated plain text bank file. */
export interface BankFile {
  fileName: string;
  content: string;
  records: number;
}
