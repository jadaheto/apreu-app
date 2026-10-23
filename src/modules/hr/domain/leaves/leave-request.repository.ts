import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import type { IsoDate } from '../common/calendar-date.js';
import type { LeaveRequest, LeaveStatus } from './leave-request.js';

export interface LeaveSearchCriteria {
  employeeId?: number;
  status?: LeaveStatus;
  /** Leaves that overlap `[from, to]`. */
  from?: IsoDate;
  to?: IsoDate;
}

/** Output port for {@link LeaveRequest}. */
export interface LeaveRequestRepository {
  findById(id: number): Promise<LeaveRequest | null>;
  /** Newest first. */
  search(criteria: LeaveSearchCriteria, page: PageRequest): Promise<Paginated<LeaveRequest>>;
  /** Pending or approved leaves of the employee overlapping the range. */
  findActiveOverlapping(employeeId: number, start: IsoDate, end: IsoDate, excludeId?: number): Promise<LeaveRequest[]>;
  /** Approved leaves of the given employees overlapping the range (payroll input). */
  findApprovedInRange(employeeIds: number[], start: IsoDate, end: IsoDate): Promise<LeaveRequest[]>;
  save(leave: LeaveRequest): Promise<void>;
}

export const LEAVE_REQUEST_REPOSITORY = Symbol('LeaveRequestRepository');
