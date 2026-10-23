/** Returns `value` when it belongs to `allowed`, otherwise `fallback` (legacy rows may hold nulls or stale values). */
export const enumValue = <T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
