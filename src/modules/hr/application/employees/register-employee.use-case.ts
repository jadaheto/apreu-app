import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../../../../shared/application/ports/password-hasher.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { roleForEmployeeType } from '../../domain/employees/employee-catalogs.js';
import { Employee, type EmployeeData } from '../../domain/employees/employee.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { USER_ACCOUNTS, type UserAccountPort } from '../../domain/employees/user-account.port.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { PayrollParametersProvider } from '../payroll/payroll-parameters.provider.js';
import { SECURE_RANDOM, type SecureRandomPort } from '../ports/secure-random.port.js';
import { toEmployeeView, type EmployeeView } from './employee-view.js';

export interface RegisterEmployeeInput {
  data: EmployeeData;
  /** Create (or link) the portal user account. Defaults to `true`. */
  createUserAccount?: boolean;
}

/** Result of linking the employee to a user account. */
export interface EmployeeAccountResult {
  userId: number;
  email: string;
  /** `false` when an existing account was linked. */
  created: boolean;
  /** Shown once to HR so it can be handed to the employee; never sent in URLs (S-5). */
  temporaryPassword: string | null;
}

export interface RegisterEmployeeOutput {
  employee: EmployeeView;
  account: EmployeeAccountResult | null;
}

/** Payload of `hr.employee-hired` (docs/eventos-integracion.md). */
export interface EmployeeHiredPayload {
  employeeId: number;
  userId: number | null;
  fullName: string;
  email: string | null;
  type: string;
}

/** Accounts of students and guardians can never become staff accounts. */
const NON_STAFF_ROLES: readonly Role[] = [Role.STUDENT, Role.PARENT];

/**
 * Registers an employee (legacy `hr/employees.php` creation branch).
 *
 * Fixes: sequential code without collisions (B-1), document uniqueness as a
 * business error instead of a raw PDO message (S-14), `user_id` always linked
 * (B-2), role derived from the employee type and never `admin` (S-3), random
 * temporary password returned in the body instead of the URL (S-5).
 * Publishes `hr.employee-hired` after the transaction commits.
 */
@Injectable()
export class RegisterEmployeeUseCase implements UseCase<RegisterEmployeeInput, RegisterEmployeeOutput> {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_ACCOUNTS) private readonly users: UserAccountPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SECURE_RANDOM) private readonly random: SecureRandomPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly parameters: PayrollParametersProvider,
  ) {}

  async execute(input: RegisterEmployeeInput): Promise<RegisterEmployeeOutput> {
    const result = await this.uow.runInTransaction(async () => {
      if (await this.employees.existsByDocument(input.data.documentNumber.trim())) {
        throw new ConflictError('Ya existe un empleado con ese número de documento.', { field: 'documentNumber' });
      }
      const employee = Employee.create(await this.employees.nextCode(), input.data);
      if (employee.integralSalary) {
        const year = CalendarDate.parts(CalendarDate.fromInstant(this.clock.now())).year;
        employee.assertIntegralSalaryMinimum((await this.parameters.forYear(year)).minimumWage);
      }
      const account = input.createUserAccount === false ? null : await this.linkAccount(employee);
      await this.employees.save(employee);
      return { employee, account };
    });

    const { employee, account } = result;
    await this.events.publish({
      name: 'hr.employee-hired',
      occurredAt: this.clock.now(),
      payload: {
        employeeId: employee.id as number,
        userId: employee.userId,
        fullName: employee.fullName,
        email: employee.email?.toString() ?? null,
        type: employee.employeeType,
      } satisfies EmployeeHiredPayload,
    });
    return { employee: toEmployeeView(employee), account };
  }

  private async linkAccount(employee: Employee): Promise<EmployeeAccountResult> {
    // Legacy fallback for employees without e-mail: `<code>@apreu.co`.
    const email = employee.email?.toString() ?? `${employee.code.toLowerCase()}@apreu.co`;
    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (NON_STAFF_ROLES.includes(existing.role)) {
        throw new ConflictError('El correo pertenece a una cuenta de estudiante o acudiente.', { field: 'email' });
      }
      if (await this.employees.existsByUserId(existing.id)) {
        throw new ConflictError('La cuenta de ese correo ya está vinculada a otro empleado.', { field: 'email' });
      }
      employee.linkUser(existing.id);
      return { userId: existing.id, email, created: false, temporaryPassword: null };
    }
    const temporaryPassword = this.random.temporaryPassword();
    const userId = await this.users.create({
      name: employee.fullName,
      email,
      passwordHash: await this.hasher.hash(temporaryPassword),
      role: roleForEmployeeType(employee.employeeType),
    });
    employee.linkUser(userId);
    return { userId, email, created: true, temporaryPassword };
  }
}
