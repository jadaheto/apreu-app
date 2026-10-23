import { toOffset, type PageRequest, type Paginated } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { IsoDate } from '../domain/common/calendar-date.js';
import type { LeaveRequest } from '../domain/leaves/leave-request.js';
import type { LeaveRequestRepository, LeaveSearchCriteria } from '../domain/leaves/leave-request.repository.js';

export class InMemoryLeaveRequestRepository implements LeaveRequestRepository {
  readonly store = new InMemoryStore<LeaveRequest>();

  async findById(id: number): Promise<LeaveRequest | null> {
    return this.store.get(id);
  }

  async search(criteria: LeaveSearchCriteria, page: PageRequest): Promise<Paginated<LeaveRequest>> {
    const matches = this.store
      .all()
      .filter((l) => criteria.employeeId === undefined || l.employeeId === criteria.employeeId)
      .filter((l) => !criteria.status || l.status === criteria.status)
      .filter((l) => !criteria.from || l.endDate >= criteria.from)
      .filter((l) => !criteria.to || l.startDate <= criteria.to)
      .sort((a, b) => (b.id as number) - (a.id as number));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }

  async findActiveOverlapping(employeeId: number, start: IsoDate, end: IsoDate, excludeId?: number) {
    return this.store
      .all()
      .filter((l) => l.employeeId === employeeId && l.id !== excludeId)
      .filter((l) => ['pending', 'approved'].includes(l.status) && l.overlaps(start, end));
  }

  async findApprovedInRange(employeeIds: number[], start: IsoDate, end: IsoDate) {
    return this.store
      .all()
      .filter((l) => employeeIds.includes(l.employeeId) && l.status === 'approved' && l.overlaps(start, end));
  }

  async save(leave: LeaveRequest): Promise<void> {
    this.store.save(leave);
  }
}
