import { NotFoundError } from '../../../../shared/domain/domain-error.js';

/** Returns the value or throws {@link NotFoundError} for `resource`/`id`. */
export const requireFound = <T>(value: T | null | undefined, resource: string, id: string | number): T => {
  if (value === null || value === undefined) throw new NotFoundError(resource, id);
  return value;
};
