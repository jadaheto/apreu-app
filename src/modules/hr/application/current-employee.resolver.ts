import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Employee } from '../domain/employees/employee.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../domain/employees/employee.repository.js';

/**
 * Resolves the employee record of the signed-in user through
 * `employees.user_id` only. Replaces the three inconsistent legacy strategies
 * (session `employee_id`, `user_id`, e-mail; D-2, B-2, B-25) so self-service
 * authorization always derives from the token.
 */
@Injectable()
export class CurrentEmployeeResolver {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  /** The actor's employee or `null` when the user is not linked to one. */
  find(actor: AuthenticatedActor): Promise<Employee | null> {
    return this.employees.findByUserId(actor.userId);
  }

  async require(actor: AuthenticatedActor): Promise<Employee> {
    const employee = await this.find(actor);
    if (!employee) {
      throw new ForbiddenError('Su usuario no está vinculado a un registro de empleado. Contacte a RR. HH.');
    }
    return employee;
  }

  /**
   * Employee targeted by a request: the actor's own record when `employeeId`
   * is omitted, otherwise the given employee if the actor is `privileged`
   * (HR/finance). Prevents the legacy IDOR on `emp_id` (portal, print pages).
   */
  async resolveTarget(
    actor: AuthenticatedActor,
    employeeId: number | undefined,
    privileged: boolean,
  ): Promise<Employee> {
    if (employeeId === undefined) return this.require(actor);
    if (!privileged) throw new ForbiddenError();
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new NotFoundError('Empleado', employeeId);
    return employee;
  }
}
