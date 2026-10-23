/**
 * Runs a block of work atomically. Every repository used inside `work`
 * participates in the same database transaction.
 */
export interface UnitOfWorkPort {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWorkPort');
