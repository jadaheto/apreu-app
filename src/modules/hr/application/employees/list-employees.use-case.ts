import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  type EmployeeSearchCriteria,
} from '../../domain/employees/employee.repository.js';
import { toEmployeeSummaryView, type EmployeeSummaryView } from './employee-view.js';

export interface ListEmployeesInput {
  criteria: EmployeeSearchCriteria;
  page: PageRequest;
}

/** Employee directory with search, filters and paging (legacy `hr/index.php`, which capped at 150 rows). */
@Injectable()
export class ListEmployeesUseCase implements UseCase<ListEmployeesInput, Paginated<EmployeeSummaryView>> {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  async execute({ criteria, page }: ListEmployeesInput): Promise<Paginated<EmployeeSummaryView>> {
    return mapPage(await this.employees.search(criteria, page), toEmployeeSummaryView);
  }
}
