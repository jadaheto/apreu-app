import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { requireFound } from '../../common/domain/require-found.js';
import { canTeach, type StaffDirectoryPort, type StaffMember } from '../../common/domain/staff-directory.port.js';

/** Loads an employee and checks it is an active teacher/director, or throws. */
export const requireEligibleTeacher = async (staff: StaffDirectoryPort, employeeId: number): Promise<StaffMember> => {
  const member = requireFound(await staff.findById(employeeId), 'Empleado', employeeId);
  if (!canTeach(member)) {
    throw new BusinessRuleViolationError(
      'Solo se pueden asignar empleados activos de tipo docente o directivo.',
      'EMPLOYEE_NOT_ELIGIBLE',
    );
  }
  return member;
};
