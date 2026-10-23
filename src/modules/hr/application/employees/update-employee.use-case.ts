import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import type { EmployeeData } from '../../domain/employees/employee.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { PayrollParametersProvider } from '../payroll/payroll-parameters.provider.js';
import { toEmployeeView, type EmployeeView } from './employee-view.js';

export interface UpdateEmployeeInput {
  employeeId: number;
  data: EmployeeData;
}

/**
 * HR edits the full employee record (legacy `hr/employees.php?edit=`): personal
 * data, contract, bank account, social security (ARL included, fixes B-3) and
 * recurring deductions. Status changes go through their own use cases.
 */
@Injectable()
export class UpdateEmployeeUseCase implements UseCase<UpdateEmployeeInput, EmployeeView> {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly parameters: PayrollParametersProvider,
  ) {}

  async execute({ employeeId, data }: UpdateEmployeeInput): Promise<EmployeeView> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new NotFoundError('Empleado', employeeId);
    if (await this.employees.existsByDocument(data.documentNumber.trim(), employeeId)) {
      throw new ConflictError('Ya existe otro empleado con ese número de documento.', { field: 'documentNumber' });
    }
    employee.updateProfile(data);
    if (employee.integralSalary) {
      const year = CalendarDate.parts(CalendarDate.fromInstant(this.clock.now())).year;
      employee.assertIntegralSalaryMinimum((await this.parameters.forYear(year)).minimumWage);
    }
    await this.employees.save(employee);
    return toEmployeeView(employee);
  }
}
