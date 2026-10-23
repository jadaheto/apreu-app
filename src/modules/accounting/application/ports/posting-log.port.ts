/**
 * Operational log for automatic postings. When an integration event cannot
 * be booked (missing parametrization, no open period…) a warning is recorded
 * instead of failing the publisher.
 */
export interface PostingLogPort {
  warn(message: string, context: Record<string, unknown>): void;
}

export const POSTING_LOG = Symbol('PostingLogPort');
