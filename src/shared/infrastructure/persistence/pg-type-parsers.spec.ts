import pg from 'pg';
import { PG_DATE_OID, registerPgTypeParsers } from './pg-type-parsers.js';

describe('registerPgTypeParsers', () => {
  it('returns DATE columns as YYYY-MM-DD strings and keeps timestamptz as Date', () => {
    registerPgTypeParsers();
    expect(pg.types.getTypeParser(PG_DATE_OID)('2026-01-10')).toBe('2026-01-10');
    expect(pg.types.getTypeParser(1184)('2026-01-10 05:00:00+00')).toBeInstanceOf(Date);
  });
});
