import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { toEmployeeView, type EmployeeView } from './employee-view.js';

/** Full record of one employee for HR. */
@Injectable()
export class GetEmployeeUseCase implements UseCase<number, EmployeeView> {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  async execute(employeeId: number): Promise<EmployeeView> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new NotFoundError('Empleado', employeeId);
    return toEmployeeView(employee);
  }
}
