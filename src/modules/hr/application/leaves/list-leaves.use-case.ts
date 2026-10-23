import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import {
  LEAVE_REQUEST_REPOSITORY,
  type LeaveRequestRepository,
  type LeaveSearchCriteria,
} from '../../domain/leaves/leave-request.repository.js';
import { toLeaveView, type LeaveView } from './leave-view.js';

export interface ListLeavesInput {
  criteria: LeaveSearchCriteria;
  page: PageRequest;
}

/** HR inbox of leave requests with filters (status, employee, date range). */
@Injectable()
export class ListLeavesUseCase implements UseCase<ListLeavesInput, Paginated<LeaveView>> {
  constructor(
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leaves: LeaveRequestRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ criteria, page }: ListLeavesInput): Promise<Paginated<LeaveView>> {
    const result = await this.leaves.search(criteria, page);
    const ids = [...new Set(result.items.map((l) => l.employeeId))];
    const names = new Map((await this.employees.findByIds(ids)).map((e) => [e.id as number, e.fullName]));
    const today = CalendarDate.fromInstant(this.clock.now());
    return { ...result, items: result.items.map((l) => toLeaveView(l, today, names.get(l.employeeId) ?? null)) };
  }
}
