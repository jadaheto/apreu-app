import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeKpis,
  type EmployeeRepository,
} from '../../domain/employees/employee.repository.js';

/** Headcount KPIs of the directory (active, on leave, active by type). */
@Injectable()
export class GetEmployeeKpisUseCase implements UseCase<void, EmployeeKpis> {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  execute(): Promise<EmployeeKpis> {
    return this.employees.kpis();
  }
}
