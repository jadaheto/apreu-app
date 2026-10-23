import { Transform } from 'class-transformer';

/** Parses `true`/`false` query string values into booleans. */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1') return true;
    if (value === 'false' || value === false || value === '0') return false;
    return value;
  });

/** `YYYY-MM` billed month. */
export const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
/** `YYYY-MM-DD` calendar day (validated further by the domain). */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
