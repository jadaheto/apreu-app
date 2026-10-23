import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import { loadLeaveForDecision } from './leave-decision.guard.js';
import { toLeaveView, type LeaveView } from './leave-view.js';

export interface ApproveLeaveInput {
  actor: AuthenticatedActor;
  leaveId: number;
  note?: string | null;
}

/** Payload of the additional event `hr.leave-approved`. */
export interface LeaveApprovedPayload {
  leaveId: number;
  employeeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
}

/**
 * HR approves a pending request (new workflow; the legacy had none, B-22).
 * Approved leaves feed the payroll calculation according to their type.
 */
@Injectable()
export class ApproveLeaveUseCase implements UseCase<ApproveLeaveInput, LeaveView> {
  constructor(
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async execute({ actor, leaveId, note }: ApproveLeaveInput): Promise<LeaveView> {
    const { leave, employeeName } = await loadLeaveForDecision(this.leaves, this.employees, leaveId, actor);
    const approvedOverlaps = (
      await this.leaves.findActiveOverlapping(leave.employeeId, leave.startDate, leave.endDate, leaveId)
    ).filter((other) => other.status === 'approved');
    if (approvedOverlaps.length > 0) {
      throw new ConflictError('El empleado ya tiene un permiso aprobado en esas fechas.');
    }
    const now = this.clock.now();
    leave.approve(actor.userId, now, note);
    await this.leaves.save(leave);
    await this.events.publish({
      name: 'hr.leave-approved',
      occurredAt: now,
      payload: {
        leaveId,
        employeeId: leave.employeeId,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
      } satisfies LeaveApprovedPayload,
    });
    return toLeaveView(leave, CalendarDate.fromInstant(now), employeeName);
  }
}
