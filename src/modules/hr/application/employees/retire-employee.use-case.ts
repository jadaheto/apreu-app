import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { assertNotSelf } from './employee-guards.js';
import { toEmployeeView, type EmployeeView } from './employee-view.js';
import { UserAccessSynchronizer } from './user-access.synchronizer.js';

export interface RetireEmployeeInput {
  actor: AuthenticatedActor;
  employeeId: number;
  retirementDate: string;
  reason: string;
}

/** Payload of the additional event `hr.employee-retired`. */
export interface EmployeeRetiredPayload {
  employeeId: number;
  userId: number | null;
  retirementDate: string;
  reason: string;
}

/**
 * Logical retirement replacing the legacy physical delete with cascades
 * (`hr/index.php` action `delete_employee`, B-27): payroll, leaves and
 * certificates are kept, the user loses access, and the employee is still
 * liquidated up to the retirement date.
 */
@Injectable()
export class RetireEmployeeUseCase implements UseCase<RetireEmployeeInput, EmployeeView> {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: UserAccessSynchronizer,
  ) {}

  async execute({ actor, employeeId, retirementDate, reason }: RetireEmployeeInput): Promise<EmployeeView> {
    const employee = await this.uow.runInTransaction(async () => {
      const found = await this.employees.findById(employeeId);
      if (!found) throw new NotFoundError('Empleado', employeeId);
      assertNotSelf(found, actor);
      found.retire(retirementDate, reason);
      await this.employees.save(found);
      await this.access.sync(found);
      return found;
    });
    await this.events.publish({
      name: 'hr.employee-retired',
      occurredAt: this.clock.now(),
      payload: {
        employeeId,
        userId: employee.userId,
        retirementDate: employee.retirementDate as string,
        reason: employee.retirementReason as string,
      } satisfies EmployeeRetiredPayload,
    });
    return toEmployeeView(employee);
  }
}
