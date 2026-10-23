import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { toEmployeeView, type EmployeeView } from '../employees/employee-view.js';

/** The signed-in employee's own record (portal "Mi información"). */
@Injectable()
export class GetMyEmployeeProfileUseCase implements UseCase<AuthenticatedActor, EmployeeView> {
  constructor(private readonly currentEmployee: CurrentEmployeeResolver) {}

  async execute(actor: AuthenticatedActor): Promise<EmployeeView> {
    return toEmployeeView(await this.currentEmployee.require(actor));
  }
}
