import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import { loadLeaveForDecision } from './leave-decision.guard.js';
import { toLeaveView, type LeaveView } from './leave-view.js';

export interface RejectLeaveInput {
  actor: AuthenticatedActor;
  leaveId: number;
  reason: string;
}

/** HR rejects a pending request with a mandatory reason. */
@Injectable()
export class RejectLeaveUseCase implements UseCase<RejectLeaveInput, LeaveView> {
  constructor(
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, leaveId, reason }: RejectLeaveInput): Promise<LeaveView> {
    const { leave, employeeName } = await loadLeaveForDecision(this.leaves, this.employees, leaveId, actor);
    const now = this.clock.now();
    leave.reject(actor.userId, now, reason);
    await this.leaves.save(leave);
    return toLeaveView(leave, CalendarDate.fromInstant(now), employeeName);
  }
}
