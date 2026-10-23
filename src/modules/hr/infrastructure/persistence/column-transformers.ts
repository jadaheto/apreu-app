import type { ValueTransformer } from 'typeorm';

/** `DECIMAL` columns arrive as strings from `pg`; expose them as numbers. */
export const decimal: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) => (value === null || value === undefined ? 0 : Number(value)),
};
