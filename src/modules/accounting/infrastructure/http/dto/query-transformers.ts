import { Transform } from 'class-transformer';

/** `YYYY-MM-DD` (the calendar validity is checked again in the domain). */
export const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DAY_MESSAGE = 'Debe ser una fecha con formato AAAA-MM-DD.';

/** Parses `true`/`false`/`1`/`0` query strings, leaving absent values undefined. */
export const ToOptionalBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    return raw === true || raw === 'true' || raw === '1';
  });
