import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import type { EmployeeRepository } from '../../domain/employees/employee.repository.js';
import type { LeaveRequest } from '../../domain/leaves/leave-request.js';
import type { LeaveRequestRepository } from '../../domain/leaves/leave-request.repository.js';

/** Loads a leave for an HR decision; nobody decides on their own request (segregation of duties). */
export const loadLeaveForDecision = async (
  leaves: LeaveRequestRepository,
  employees: EmployeeRepository,
  leaveId: number,
  actor: AuthenticatedActor,
): Promise<{ leave: LeaveRequest; employeeName: string | null }> => {
  const leave = await leaves.findById(leaveId);
  if (!leave) throw new NotFoundError('Solicitud de permiso', leaveId);
  const employee = await employees.findById(leave.employeeId);
  if (employee?.userId === actor.userId) {
    throw new ForbiddenError('No puede decidir sobre sus propias solicitudes de permiso.');
  }
  return { leave, employeeName: employee?.fullName ?? null };
};
