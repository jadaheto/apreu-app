import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError, ConflictError } from '../../../../shared/domain/domain-error.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { LeaveRequest, type LeaveType } from '../../domain/leaves/leave-request.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';
import { toLeaveView, type LeaveView } from './leave-view.js';

export interface RequestLeaveInput {
  actor: AuthenticatedActor;
  /** Only HR may request on behalf of another employee; omitted = the actor's own record. */
  employeeId?: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * Registers a permission/absence request in `pending` status (legacy
 * `employee/permisos.php` and `hr/portal.php?section=leaves`). Validates the
 * leave type and dates (B-21) and rejects overlaps with other pending or
 * approved requests of the same employee.
 */
@Injectable()
export class RequestLeaveUseCase implements UseCase<RequestLeaveInput, LeaveView> {
  constructor(
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute(input: RequestLeaveInput): Promise<LeaveView> {
    const employee = await this.currentEmployee.resolveTarget(input.actor, input.employeeId, isHrManager(input.actor));
    if (employee.status === 'retired' || employee.status === 'inactive') {
      throw new BusinessRuleViolationError('El empleado no tiene un contrato vigente.', 'EMPLOYEE_NOT_ACTIVE');
    }
    const leave = LeaveRequest.create({
      employeeId: employee.id as number,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      requestedBy: input.actor.userId,
    });
    const overlapping = await this.leaves.findActiveOverlapping(leave.employeeId, leave.startDate, leave.endDate);
    if (overlapping.length > 0) {
      throw new ConflictError('Ya existe una solicitud pendiente o aprobada que se cruza con esas fechas.', {
        leaveIds: overlapping.map((l) => l.id),
      });
    }
    await this.leaves.save(leave);
    return toLeaveView(leave, CalendarDate.fromInstant(this.clock.now()), employee.fullName);
  }
}
