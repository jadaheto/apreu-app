import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { Role } from '../../../shared/domain/role.js';
import { FakePasswordHasher, FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { CurrentEmployeeResolver } from '../application/current-employee.resolver.js';
import { UserAccessSynchronizer } from '../application/employees/user-access.synchronizer.js';
import { PayrollParametersProvider } from '../application/payroll/payroll-parameters.provider.js';
import { Employee, type EmployeeData } from '../domain/employees/employee.js';
import { validEmployeeData } from './fixtures.js';
import { InMemoryEmployeeRepository } from './in-memory-employee.repository.js';
import { InMemoryLeaveRequestRepository } from './in-memory-leave-request.repository.js';
import {
  FakeDocumentRenderer,
  FakeInstitutionProfile,
  FakeSecureRandom,
  FakeUserAccounts,
  InMemoryIssuedDocumentRepository,
  InMemoryStickerRepository,
} from './in-memory-misc.js';
import {
  InMemoryPayrollNoveltyRepository,
  InMemoryPayrollParametersRepository,
  InMemoryPayrollPaymentRepository,
  InMemoryPayrollPeriodRepository,
} from './in-memory-payroll.repositories.js';

/** Builds an actor for tests. */
export const actor = (role: Role, userId = 1): AuthenticatedActor => ({
  userId,
  role,
  email: `u${userId}@colegio.co`,
  name: `Usuario ${userId}`,
  tenant: 'colegio-a',
});

/** Every fake of the HR context wired together, clock frozen at 2026-03-15 (Bogotá). */
export const createHrTestContext = () => {
  const employees = new InMemoryEmployeeRepository();
  const periods = new InMemoryPayrollPeriodRepository();
  const parametersRepository = new InMemoryPayrollParametersRepository();
  const users = new FakeUserAccounts();
  const context = {
    clock: new FixedClock(),
    uow: new FakeUnitOfWork(),
    events: new RecordingEventBus(),
    hasher: new FakePasswordHasher(),
    random: new FakeSecureRandom(),
    institution: new FakeInstitutionProfile(),
    renderer: new FakeDocumentRenderer(),
    users,
    employees,
    leaves: new InMemoryLeaveRequestRepository(),
    periods,
    payments: new InMemoryPayrollPaymentRepository(periods),
    novelties: new InMemoryPayrollNoveltyRepository(),
    parametersRepository,
    documents: new InMemoryIssuedDocumentRepository(),
    stickers: new InMemoryStickerRepository(),
    currentEmployee: new CurrentEmployeeResolver(employees),
    parameters: new PayrollParametersProvider(parametersRepository),
    access: new UserAccessSynchronizer(users),
    /** Persists an employee, optionally linked to a new user with the given role. */
    async addEmployee(data: Partial<EmployeeData> = {}, role: Role | null = Role.TEACHER) {
      const employee = Employee.create(
        await employees.nextCode(),
        validEmployeeData({
          documentNumber: String(1000 + employees.store.all().length),
          ...data,
        }),
      );
      if (role) employee.linkUser(users.add(`${employee.code.toLowerCase()}@colegio.co`, role).id);
      await employees.save(employee);
      return employee;
    },
  };
  return context;
};

export type HrTestContext = ReturnType<typeof createHrTestContext>;
