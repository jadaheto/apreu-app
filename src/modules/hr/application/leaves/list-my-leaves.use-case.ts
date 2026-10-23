import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { LEAVE_REQUEST_REPOSITORY, type LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { toLeaveView, type LeaveView } from './leave-view.js';

export interface ListMyLeavesInput {
  actor: AuthenticatedActor;
  page: PageRequest;
}

/** The employee's own leave history (self-service). */
@Injectable()
export class ListMyLeavesUseCase implements UseCase<ListMyLeavesInput, Paginated<LeaveView>> {
  constructor(
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, page }: ListMyLeavesInput): Promise<Paginated<LeaveView>> {
    const employee = await this.currentEmployee.require(actor);
    const today = CalendarDate.fromInstant(this.clock.now());
    const result = await this.leaves.search({ employeeId: employee.id as number }, page);
    return mapPage(result, (leave) => toLeaveView(leave, today, employee.fullName));
  }
}
