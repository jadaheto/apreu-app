import type { EmployeeData } from '../domain/employees/employee.js';

/** Valid employee form data for tests. */
export const validEmployeeData = (overrides: Partial<EmployeeData> = {}): EmployeeData => ({
  firstName: ' Ana ',
  lastName: 'Pérez',
  documentType: 'cc',
  documentNumber: '1012345678',
  gender: 'F',
  email: 'ANA@colegio.edu.co',
  employeeType: 'docente',
  contractType: 'indefinido',
  baseSalary: 2_500_000,
  hireDate: '2024-02-01',
  ...overrides,
});
