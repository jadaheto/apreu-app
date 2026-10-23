import type { ValueTransformer } from 'typeorm';

/** `numeric` columns arrive as strings from `pg`; expose them as numbers. */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) => (value === null ? null : Number(value)),
};

/** `DATE` values may come as `Date` (raw queries) or `YYYY-MM-DD` strings (entities). */
export const toIsoDate = (value: Date | string): string =>
  value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : value.slice(0, 10);
