/**
 * PostgreSQL helpers for hand-written SQL (ADR-0008).
 *
 * Raw queries use positional parameters (`$1`, `$2`, …). Dynamic filters build
 * their parameter list with {@link SqlParams} so the numbering never drifts.
 */

/** Collects the values of a parameterized query and returns their `$n` placeholders. */
export class SqlParams {
  private readonly items: unknown[] = [];

  constructor(initial: readonly unknown[] = []) {
    this.items.push(...initial);
  }

  /** Adds a value and returns its placeholder (`$n`). */
  add(value: unknown): string {
    this.items.push(value);
    return `$${this.items.length}`;
  }

  /** Values in placeholder order, for `manager.query(sql, params.values)`. */
  get values(): unknown[] {
    return [...this.items];
  }

  /** Number of values added so far. */
  get length(): number {
    return this.items.length;
  }
}

/** `$start, $start+1, …` for `count` values (prefer `= ANY($n)` with an array parameter). */
export const placeholders = (count: number, start = 1): string =>
  Array.from({ length: count }, (_, index) => `$${start + index}`).join(', ');

/** `%term%` with the LIKE wildcards (`%`, `_`, `\`) escaped (`\` is PostgreSQL's default LIKE escape). */
export const likePattern = (term: string): string => `%${term.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/**
 * Accent- and case-insensitive match, as MariaDB's `utf8mb4_general_ci` did:
 * `f_unaccent(column) ILIKE f_unaccent($n)`. Pass a {@link likePattern} value.
 */
export const unaccentLike = (column: string, placeholder: number | string): string =>
  `f_unaccent(${column}) ILIKE f_unaccent(${typeof placeholder === 'number' ? `$${placeholder}` : placeholder})`;

/**
 * Number from a `pg` value: `numeric`, `bigint` and `COUNT(*)`/`SUM` arrive as
 * strings. `null`/`undefined` become `0`.
 */
export const toNumber = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

/** Like {@link toNumber} but keeps `null` (nullable aggregates such as `MAX`). */
export const toNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/** PostgreSQL SQLSTATE for a unique-constraint violation. */
export const UNIQUE_VIOLATION = '23505';

/** True for a unique-constraint violation, raised by `pg` directly or wrapped by TypeORM. */
export const isUniqueViolation = (error: unknown): boolean => {
  const candidate = error as { code?: string; driverError?: { code?: string } } | null;
  return candidate?.code === UNIQUE_VIOLATION || candidate?.driverError?.code === UNIQUE_VIOLATION;
};

/**
 * Takes a transaction-scoped advisory lock (replaces MariaDB `GET_LOCK`); it is
 * released automatically at commit/rollback. Must run inside a transaction.
 */
export const advisoryXactLock = async (manager: SqlExecutor, key: string): Promise<void> => {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
};

/** Anything able to run raw SQL (`EntityManager`, `DataSource`, `QueryRunner`). */
export interface SqlExecutor {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/**
 * Rows of a raw statement. TypeORM's PostgreSQL driver returns `[rows, rowCount]`
 * for `UPDATE`/`DELETE` (also with `RETURNING`) and plain rows otherwise; this
 * normalizes both shapes.
 */
export const rowsOf = <T>(result: unknown): T[] => {
  if (!Array.isArray(result)) return [];
  if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as T[];
  return result as T[];
};

/** Affected-row count of a raw `UPDATE`/`DELETE` (`[rows, rowCount]` from TypeORM's PostgreSQL driver). */
export const affectedRowsOf = (result: unknown): number => {
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[1];
  }
  return Array.isArray(result) ? result.length : 0;
};

/** Runs `INSERT/UPDATE/DELETE … RETURNING …` and returns the returned rows. */
export const queryReturning = async <T>(executor: SqlExecutor, sql: string, parameters: unknown[] = []): Promise<T[]> =>
  rowsOf<T>(await executor.query(sql, parameters));
