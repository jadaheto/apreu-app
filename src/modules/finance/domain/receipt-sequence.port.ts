/**
 * Gap-free receipt counter per (prefix, year).
 *
 * `next` must be called inside a unit of work: the adapter locks the counter
 * row until the transaction ends, so concurrent cashiers never obtain the same
 * number (legacy bug B1) and a missing counter is created on demand (bug B2).
 */
export interface ReceiptSequencePort {
  next(prefix: string, year: number): Promise<number>;
}

export const RECEIPT_SEQUENCE = Symbol('ReceiptSequencePort');
