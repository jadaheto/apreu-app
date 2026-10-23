import pg from 'pg';

/** OID of the PostgreSQL `date` type. */
export const PG_DATE_OID = 1082;

/**
 * Global `pg` type parsers (ADR-0008), registered once when the persistence
 * layer loads:
 *
 * - `date` → the raw `'YYYY-MM-DD'` string. By default `pg` builds a JS `Date`
 *   at local midnight of the Node process, which shifts the day when the
 *   process runs in UTC and the value is shown in Bogota. School-day values
 *   (due dates, birth dates, periods, attendance) are calendar dates, not instants.
 * - `timestamptz` is left untouched (JS `Date`).
 */
export const registerPgTypeParsers = (): void => {
  pg.types.setTypeParser(PG_DATE_OID, (value: string) => value);
};

registerPgTypeParsers();
