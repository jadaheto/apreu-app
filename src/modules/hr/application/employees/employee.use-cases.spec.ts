import { ConflictError, ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { validEmployeeData } from '../../testing/fixtures.js';
import { actor, createHrTestContext, type HrTestContext } from '../../testing/hr-test-context.js';
import { ChangeEmployeeStatusUseCase } from './change-employee-status.use-case.js';
import { GetEmployeeKpisUseCase } from './get-employee-kpis.use-case.js';
import { GetEmployeeUseCase } from './get-employee.use-case.js';
import { ListEmployeesUseCase } from './list-employees.use-case.js';
import { RegisterEmployeeUseCase } from './register-employee.use-case.js';
import { RetireEmployeeUseCase } from './retire-employee.use-case.js';
import { UpdateEmployeeUseCase } from './update-employee.use-case.js';

describe('employee use cases', () => {
  let ctx: HrTestContext;
  const hr = actor(Role.HR, 1);

  beforeEach(() => {
    ctx = createHrTestContext();
  });

  describe('RegisterEmployeeUseCase', () => {
    const register = (data = validEmployeeData(), createUserAccount?: boolean) =>
      new RegisterEmployeeUseCase(
        ctx.employees,
        ctx.users,
        ctx.hasher,
        ctx.random,
        ctx.uow,
        ctx.events as never,
        ctx.clock,
        ctx.parameters,
      ).execute({ data, createUserAccount });

    it('creates the employee, a linked teacher account and publishes hr.employee-hired', async () => {
      const result = await register();

      expect(result.employee).toMatchObject({ code: 'EMP0001', fullName: 'Ana Pérez', status: 'active' });
      expect(result.account).toMatchObject({
        email: 'ana@colegio.edu.co',
        created: true,
        temporaryPassword: 'Temporal123',
      });
      const user = ctx.users.accounts.get(result.account!.userId)!;
      expect(user).toMatchObject({ role: Role.TEACHER, passwordHash: 'hashed:Temporal123', name: 'Ana Pérez' });
      expect(result.employee.userId).toBe(user.id);
      expect(ctx.uow.transactions).toBe(1);
      expect(ctx.events.published).toEqual([
        expect.objectContaining({
          name: 'hr.employee-hired',
          payload: {
            employeeId: 1,
            userId: user.id,
            fullName: 'Ana Pérez',
            email: 'ana@colegio.edu.co',
            type: 'docente',
          },
        }),
      ]);
    });

    it('never grants admin to administrative staff (legacy S-3)', async () => {
      const result = await register(validEmployeeData({ employeeType: 'administrativo' }));
      expect(ctx.users.accounts.get(result.account!.userId)?.role).toBe(Role.EMPLOYEE);
    });

    it('generates sequential codes without collisions and a fallback e-mail', async () => {
      await register();
      const second = await register(validEmployeeData({ documentNumber: '999', email: null }));
      expect(second.employee.code).toBe('EMP0002');
      expect(second.account?.email).toBe('emp0002@apreu.co');
    });

    it('links an existing staff account instead of creating another', async () => {
      const existing = ctx.users.add('ana@colegio.edu.co', Role.HR);
      const result = await register();
      expect(result.account).toEqual({
        userId: existing.id,
        email: 'ana@colegio.edu.co',
        created: false,
        temporaryPassword: null,
      });
      expect(existing.role).toBe(Role.HR);
    });

    it.each([Role.STUDENT, Role.PARENT])('refuses to link a %s account', async (role) => {
      ctx.users.add('ana@colegio.edu.co', role);
      await expect(register()).rejects.toBeInstanceOf(ConflictError);
    });

    it('refuses accounts already linked to another employee and duplicated documents', async () => {
      await register();
      await expect(register(validEmployeeData({ documentNumber: '555' }))).rejects.toThrow(/otro empleado/);
      await expect(register(validEmployeeData({ email: 'otra@colegio.co' }))).rejects.toThrow(/número de documento/);
    });

    it('can skip the user account', async () => {
      const result = await register(validEmployeeData(), false);
      expect(result.account).toBeNull();
      expect(ctx.users.accounts.size).toBe(0);
    });

    it('validates the integral salary against 13 SMMLV of the current year', async () => {
      await expect(register(validEmployeeData({ integralSalary: true, baseSalary: 15_000_000 }))).rejects.toMatchObject(
        {
          code: 'INTEGRAL_SALARY_TOO_LOW',
        },
      );
    });
  });

  describe('UpdateEmployeeUseCase', () => {
    it('updates the HR-managed data', async () => {
      const employee = await ctx.addEmployee();
      const view = await new UpdateEmployeeUseCase(ctx.employees, ctx.clock, ctx.parameters).execute({
        employeeId: employee.id as number,
        data: validEmployeeData({
          documentNumber: employee.documentNumber,
          arl: 'Sura',
          arlRiskClass: 2,
          fixedLibranza: 50_000,
        }),
      });
      expect(view.socialSecurity).toMatchObject({ arl: 'Sura', arlRiskClass: 2 });
      expect(view.recurringDeductions.libranza).toBe(50_000);
    });

    it('rejects unknown employees and documents of other employees', async () => {
      const useCase = new UpdateEmployeeUseCase(ctx.employees, ctx.clock, ctx.parameters);
      await expect(useCase.execute({ employeeId: 99, data: validEmployeeData() })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      const a = await ctx.addEmployee();
      const b = await ctx.addEmployee();
      await expect(
        useCase.execute({ employeeId: b.id as number, data: validEmployeeData({ documentNumber: a.documentNumber }) }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('ChangeEmployeeStatusUseCase', () => {
    const change = (employeeId: number, status: 'suspended' | 'active' | 'on_leave', by = hr) =>
      new ChangeEmployeeStatusUseCase(ctx.employees, ctx.uow, ctx.access).execute({ actor: by, employeeId, status });

    it('synchronizes the user access on every change (B-26)', async () => {
      const employee = await ctx.addEmployee({}, Role.ADMIN);
      await change(employee.id as number, 'suspended');
      expect(ctx.users.accounts.get(employee.userId as number)?.isActive).toBe(false);
      await change(employee.id as number, 'active');
      await change(employee.id as number, 'on_leave');
      expect(ctx.users.accounts.get(employee.userId as number)?.isActive).toBe(true);
    });

    it('never touches superadmin accounts', async () => {
      const employee = await ctx.addEmployee({}, Role.SUPERADMIN);
      await change(employee.id as number, 'suspended');
      expect(ctx.users.accounts.get(employee.userId as number)?.isActive).toBe(true);
    });

    it("forbids changing one's own record and unknown employees", async () => {
      const own = await ctx.addEmployee({}, Role.HR);
      await expect(change(own.id as number, 'suspended', actor(Role.HR, own.userId as number))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(change(404, 'suspended')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('RetireEmployeeUseCase', () => {
    it('retires logically, revokes access and publishes hr.employee-retired', async () => {
      const employee = await ctx.addEmployee();
      const view = await new RetireEmployeeUseCase(
        ctx.employees,
        ctx.uow,
        ctx.events as never,
        ctx.clock,
        ctx.access,
      ).execute({
        actor: hr,
        employeeId: employee.id as number,
        retirementDate: '2026-03-31',
        reason: 'Renuncia',
      });
      expect(view).toMatchObject({ status: 'retired', retirementDate: '2026-03-31' });
      expect(ctx.employees.store.get(employee.id as number)).not.toBeNull();
      expect(ctx.users.accounts.get(employee.userId as number)?.isActive).toBe(false);
      expect(ctx.events.published[0]).toMatchObject({
        name: 'hr.employee-retired',
        payload: { employeeId: employee.id, retirementDate: '2026-03-31', reason: 'Renuncia' },
      });
    });
  });

  describe('queries', () => {
    it('lists, filters, gets and counts employees', async () => {
      await ctx.addEmployee({ firstName: 'Luis', employeeType: 'administrativo' });
      const ana = await ctx.addEmployee();
      const page = await new ListEmployeesUseCase(ctx.employees).execute({
        criteria: { search: 'ana', type: 'docente' },
        page: { page: 1, limit: 10 },
      });
      expect(page.items.map((e) => e.fullName)).toEqual(['Ana Pérez']);
      expect(page.items[0]).not.toHaveProperty('bankAccount');

      await expect(new GetEmployeeUseCase(ctx.employees).execute(ana.id as number)).resolves.toMatchObject({
        code: ana.code,
      });
      await expect(new GetEmployeeUseCase(ctx.employees).execute(77)).rejects.toBeInstanceOf(NotFoundError);
      await expect(new GetEmployeeKpisUseCase(ctx.employees).execute()).resolves.toMatchObject({
        active: 2,
        byType: { docente: 1, administrativo: 1 },
      });
    });
  });
});
