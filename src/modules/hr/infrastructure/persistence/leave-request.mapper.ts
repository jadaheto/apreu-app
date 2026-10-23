import { LEAVE_STATUSES, LEAVE_TYPES, LeaveRequest } from '../../domain/leaves/leave-request.js';
import { enumValue } from './enum-value.js';
import { LeaveRequestOrmEntity } from './leave-request.orm-entity.js';

/** Translates between `employee_leaves` rows and {@link LeaveRequest}. */
export const LeaveRequestMapper = {
  toDomain(row: LeaveRequestOrmEntity): LeaveRequest {
    return LeaveRequest.restore(row.id, {
      employeeId: row.employeeId,
      leaveType: enumValue(row.leaveType, LEAVE_TYPES, 'otro'),
      startDate: row.startDate,
      endDate: row.endDate,
      reason: row.reason,
      status: enumValue(row.status, LEAVE_STATUSES, 'pending'),
      requestedBy: row.requestedBy,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt,
    });
  },

  toPersistence(leave: LeaveRequest): LeaveRequestOrmEntity {
    const row = new LeaveRequestOrmEntity();
    if (leave.id !== null) row.id = leave.id;
    Object.assign(row, {
      employeeId: leave.employeeId,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      status: leave.status,
      requestedBy: leave.requestedBy,
      decidedBy: leave.decidedBy,
      decidedAt: leave.decidedAt,
      decisionNote: leave.decisionNote,
    });
    return row;
  },
};
