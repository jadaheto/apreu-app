import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import type { EmployeeStatus } from '../../domain/employees/employee-catalogs.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { assertNotSelf } from './employee-guards.js';
import { toEmployeeView, type EmployeeView } from './employee-view.js';
import { UserAccessSynchronizer } from './user-access.synchronizer.js';

export interface ChangeEmployeeStatusInput {
  actor: AuthenticatedActor;
  employeeId: number;
  status: EmployeeStatus;
}

/**
 * Quick status change of the directory (`hr/index.php` action
 * `update_status`), following the employee state machine and always
 * synchronizing the user's access (fixes B-26).
 */
@Injectable()
export class ChangeEmployeeStatusUseCase implements UseCase<ChangeEmployeeStatusInput, EmployeeView> {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly access: UserAccessSynchronizer,
  ) {}

  execute({ actor, employeeId, status }: ChangeEmployeeStatusInput): Promise<EmployeeView> {
    return this.uow.runInTransaction(async () => {
      const employee = await this.employees.findById(employeeId);
      if (!employee) throw new NotFoundError('Empleado', employeeId);
      assertNotSelf(employee, actor);
      employee.changeStatus(status);
      await this.employees.save(employee);
      await this.access.sync(employee);
      return toEmployeeView(employee);
    });
  }
}
