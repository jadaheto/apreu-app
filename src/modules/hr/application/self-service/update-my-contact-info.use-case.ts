import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ContactInfo } from '../../domain/employees/employee.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { toEmployeeView, type EmployeeView } from '../employees/employee-view.js';

export interface UpdateMyContactInfoInput {
  actor: AuthenticatedActor;
  contact: ContactInfo;
}

/**
 * Self-service update of phone, e-mail and address only. Recurring
 * deductions, bank account and social security stay HR-only (fixes S-4).
 */
@Injectable()
export class UpdateMyContactInfoUseCase implements UseCase<UpdateMyContactInfoInput, EmployeeView> {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, contact }: UpdateMyContactInfoInput): Promise<EmployeeView> {
    const employee = await this.currentEmployee.require(actor);
    employee.updateContactInfo(contact);
    await this.employees.save(employee);
    return toEmployeeView(employee);
  }
}
