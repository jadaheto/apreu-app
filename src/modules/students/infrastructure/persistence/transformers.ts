import type { ValueTransformer } from 'typeorm';

/** `numeric` columns arrive as strings from `pg`; expose them as numbers. */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null || value === undefined ? null : Number(value)),
};
