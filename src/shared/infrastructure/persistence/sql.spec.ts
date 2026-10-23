import type { EntityManager } from 'typeorm';
import {
  advisoryXactLock,
  affectedRowsOf,
  isUniqueViolation,
  likePattern,
  placeholders,
  queryReturning,
  rowsOf,
  SqlParams,
  toNullableNumber,
  toNumber,
  unaccentLike,
} from './sql.js';

describe('PostgreSQL SQL helpers', () => {
  it('numbers parameters in insertion order', () => {
    const params = new SqlParams(['a']);
    expect(params.add(5)).toBe('$2');
    expect(params.add(null)).toBe('$3');
    expect(params.values).toEqual(['a', 5, null]);
    expect(params.length).toBe(3);
  });

  it('builds positional placeholder lists', () => {
    expect(placeholders(3)).toBe('$1, $2, $3');
    expect(placeholders(2, 4)).toBe('$4, $5');
  });

  it('escapes LIKE wildcards and builds accent-insensitive matches', () => {
    expect(likePattern(' 50%_off\\ ')).toBe('%50\\%\\_off\\\\%');
    expect(unaccentLike('s.code', 2)).toBe('f_unaccent(s.code) ILIKE f_unaccent($2)');
    expect(unaccentLike('u.name', ':term')).toBe('f_unaccent(u.name) ILIKE f_unaccent(:term)');
  });

  it('parses numeric strings returned by pg', () => {
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(toNullableNumber(undefined)).toBeNull();
    expect(toNullableNumber('7')).toBe(7);
  });

  it('detects unique violations directly or wrapped by TypeORM', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ driverError: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('normalizes the [rows, rowCount] shape of UPDATE/DELETE results', () => {
    expect(rowsOf([[{ id: 1 }], 1])).toEqual([{ id: 1 }]);
    expect(rowsOf([{ id: 2 }])).toEqual([{ id: 2 }]);
    expect(rowsOf(undefined)).toEqual([]);
    expect(affectedRowsOf([[], 3])).toBe(3);
    expect(affectedRowsOf([{ id: 1 }])).toBe(1);
  });

  it('returns RETURNING rows and takes transaction-scoped advisory locks', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[{ n: 4 }], 1])
      .mockResolvedValueOnce([]);
    const manager = { query } as unknown as EntityManager;

    await expect(queryReturning(manager, 'UPDATE t SET n = n + 1 RETURNING n')).resolves.toEqual([{ n: 4 }]);
    await advisoryXactLock(manager, 'receipts');

    expect(query).toHaveBeenLastCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['receipts']);
  });
});
