import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { ForbiddenError } from '../../../../shared/domain/domain-error.js';
import type { Employee } from '../../domain/employees/employee.js';

/** Fails when HR tries to change its own employment record (legacy rule 8). */
export const assertNotSelf = (employee: Employee, actor: AuthenticatedActor): void => {
  if (employee.userId !== null && employee.userId === actor.userId) {
    throw new ForbiddenError('No puede cambiar el estado de su propio registro de empleado.');
  }
};
