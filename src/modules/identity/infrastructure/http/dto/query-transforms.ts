import { Transform } from 'class-transformer';

/** Parses `true`/`false` query-string values; anything else is left for `@IsBoolean` to reject. */
export const ToBoolean = () =>
  Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  );

/** Strict `YYYY-MM-DD` day. */
export const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
