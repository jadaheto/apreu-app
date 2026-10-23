import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';
import { toLeaveView, type LeaveView } from './leave-view.js';

export interface CancelLeaveInput {
  actor: AuthenticatedActor;
  leaveId: number;
}

/**
 * Cancels a request. Employees only their own pending requests (another
 * employee's request answers 404 to avoid IDOR); HR any pending request or an
 * approved one that has not finished.
 */
@Injectable()
export class CancelLeaveUseCase implements UseCase<CancelLeaveInput, LeaveView> {
  constructor(
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, leaveId }: CancelLeaveInput): Promise<LeaveView> {
    const leave = await this.leaves.findById(leaveId);
    if (!leave) throw new NotFoundError('Solicitud de permiso', leaveId);
    const byHumanResources = isHrManager(actor);
    if (!byHumanResources) {
      const own = await this.currentEmployee.require(actor);
      if (own.id !== leave.employeeId) throw new NotFoundError('Solicitud de permiso', leaveId);
    }
    const now = this.clock.now();
    const today = CalendarDate.fromInstant(now);
    leave.cancel(actor.userId, now, today, byHumanResources);
    await this.leaves.save(leave);
    return toLeaveView(leave, today);
  }
}
