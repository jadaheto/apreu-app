import type { IsoDate } from '../../domain/common/calendar-date.js';
import type { LeavePayTreatment, LeaveRequest, LeaveStatus, LeaveType } from '../../domain/leaves/leave-request.js';

/** Leave request read model; `displayStatus` adds the derived "taken" state. */
export interface LeaveView {
  id: number;
  employeeId: number;
  employeeName: string | null;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  displayStatus: LeaveStatus | 'taken';
  payTreatment: LeavePayTreatment;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date | null;
}

export const toLeaveView = (leave: LeaveRequest, today: IsoDate, employeeName: string | null = null): LeaveView => ({
  id: leave.id as number,
  employeeId: leave.employeeId,
  employeeName,
  leaveType: leave.leaveType,
  startDate: leave.startDate,
  endDate: leave.endDate,
  days: leave.days,
  reason: leave.reason,
  status: leave.status,
  displayStatus: leave.isTaken(today) ? 'taken' : leave.status,
  payTreatment: leave.payTreatment,
  decisionNote: leave.decisionNote,
  decidedAt: leave.decidedAt,
  createdAt: leave.createdAt,
});
