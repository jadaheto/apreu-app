import type { VoucherType } from '../../domain/voucher-type.js';

/**
 * Consecutive generator per voucher type (RN-JE-05). Implementations must
 * lock the sequence row so concurrent postings never collide (bug 6: the
 * legacy `MAX + 1` raced). Must be called inside a unit of work.
 */
export interface VoucherSequencePort {
  /** Next consecutive already padded to 6 digits, e.g. `000043`. */
  next(type: VoucherType): Promise<string>;
}

export const VOUCHER_SEQUENCE = Symbol('VoucherSequencePort');
