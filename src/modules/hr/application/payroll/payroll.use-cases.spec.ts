import { ConflictError, ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { LeaveRequest } from '../../domain/leaves/leave-request.js';
import { actor, createHrTestContext, type HrTestContext } from '../../testing/hr-test-context.js';
import { ApprovePayrollPeriodUseCase } from './approve-payroll-period.use-case.js';
import { CalculatePayrollPeriodUseCase } from './calculate-payroll-period.use-case.js';
import { CancelPayrollPeriodUseCase } from './cancel-payroll-period.use-case.js';
import { ConfigurePayrollParametersUseCase } from './configure-payroll-parameters.use-case.js';
import { CreatePayrollPeriodUseCase } from './create-payroll-period.use-case.js';
import { GetPayrollKpisUseCase } from './get-payroll-kpis.use-case.js';
import { GetPayrollParametersUseCase } from './get-payroll-parameters.use-case.js';
import { GetPayrollPeriodDetailUseCase } from './get-payroll-period-detail.use-case.js';
import { ListPayrollPeriodsUseCase } from './list-payroll-periods.use-case.js';
import { PayPayrollPeriodUseCase } from './pay-payroll-period.use-case.js';
import { RegisterPayrollNoveltyUseCase } from './register-payroll-novelty.use-case.js';
import { RemovePayrollNoveltyUseCase } from './remove-payroll-novelty.use-case.js';

const SMMLV = 1_750_905;

describe('payroll use cases', () => {
  let ctx: HrTestContext;
  const hr = actor(Role.HR, 1);
  const otherHr = actor(Role.HR, 2);

  const createPeriod = (overrides: Record<string, unknown> = {}) =>
    new CreatePayrollPeriodUseCase(ctx.periods, ctx.parameters).execute({
      actor: hr,
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      paymentDate: '2026-03-30',
      frequency: 'monthly',
      ...overrides,
    });
  const calculate = (periodId: number, by = hr) =>
    new CalculatePayrollPeriodUseCase(
      ctx.periods,
      ctx.payments,
      ctx.novelties,
      ctx.employees,
      ctx.leaves,
      ctx.uow,
      ctx.clock,
      ctx.parameters,
    ).execute({ actor: by, periodId });
  const addNovelty = (periodId: number, employeeId: number, type = 'libranza' as const, amount = 50_000) =>
    new RegisterPayrollNoveltyUseCase(ctx.periods, ctx.novelties, ctx.employees, ctx.uow).execute({
      actor: hr,
      periodId,
      employeeId,
      type,
      amount,
    });
  const approve = (periodId: number, by = otherHr) =>
    new ApprovePayrollPeriodUseCase(ctx.periods, ctx.clock).execute({ actor: by, periodId });
  const pay = (periodId: number) =>
    new PayPayrollPeriodUseCase(ctx.periods, ctx.payments, ctx.uow, ctx.events as never, ctx.clock).execute(periodId);

  beforeEach(() => {
    ctx = createHrTestContext();
  });

  describe('parameters', () => {
    it('returns the built-in legal values and the configured ones', async () => {
      const get = new GetPayrollParametersUseCase(ctx.parameters);
      await expect(get.execute(2026)).resolves.toMatchObject({
        source: 'legal-default',
        minimumWage: SMMLV,
        uvt: 52_374,
      });
      await expect(get.execute(2030)).rejects.toBeInstanceOf(NotFoundError);

      await new ConfigurePayrollParametersUseCase(ctx.parametersRepository, ctx.periods).execute({
        actor: actor(Role.ADMIN),
        year: 2030,
        values: {
          minimumWage: 2_500_000,
          transportAllowance: 300_000,
          uvt: 60_000,
          employerContributionExemption: true,
        },
      });
      await expect(get.execute(2030)).resolves.toMatchObject({
        source: 'configured',
        employerContributionExemption: true,
      });
    });

    it('locks the parameters of a year with paid periods', async () => {
      await ctx.addEmployee();
      const { id } = await createPeriod();
      await calculate(id);
      await approve(id);
      await pay(id);
      await expect(
        new ConfigurePayrollParametersUseCase(ctx.parametersRepository, ctx.periods).execute({
          actor: actor(Role.ADMIN),
          year: 2026,
          values: { minimumWage: 1, transportAllowance: 1, uvt: 1 },
        }),
      ).rejects.toMatchObject({ code: 'PAYROLL_PARAMETERS_LOCKED' });
    });
  });

  describe('CreatePayrollPeriodUseCase', () => {
    it('creates a draft and rejects overlaps (B-10)', async () => {
      await expect(createPeriod()).resolves.toMatchObject({ status: 'draft', name: 'Nómina marzo 2026' });
      await expect(
        createPeriod({ startDate: '2026-03-16', endDate: '2026-03-31', frequency: 'biweekly' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('requires parameters for the year', async () => {
      await expect(
        createPeriod({ startDate: '2031-01-01', endDate: '2031-01-31', paymentDate: '2031-01-30' }),
      ).rejects.toMatchObject({ code: 'PAYROLL_PARAMETERS_MISSING' });
    });
  });

  describe('CalculatePayrollPeriodUseCase', () => {
    it('liquidates eligible employees only, in one transaction', async () => {
      const active = await ctx.addEmployee({ baseSalary: SMMLV });
      const onLeave = await ctx.addEmployee({ baseSalary: SMMLV });
      onLeave.changeStatus('on_leave');
      await ctx.addEmployee({ contractType: 'prestacion' });
      const suspended = await ctx.addEmployee();
      suspended.changeStatus('suspended');
      const retired = await ctx.addEmployee({ baseSalary: SMMLV, hireDate: '2020-01-01' });
      retired.retire('2026-03-10', 'Renuncia');
      const { id } = await createPeriod();
      ctx.uow.transactions = 0;

      const result = await calculate(id);

      expect(ctx.uow.transactions).toBe(1);
      expect(result.payslips).toBe(3);
      expect(result.period).toMatchObject({ status: 'calculated' });
      const payments = await ctx.payments.findByPeriod(id);
      expect(payments.map((p) => p.employeeId).sort()).toEqual([active.id, onLeave.id, retired.id]);
      expect(payments.find((p) => p.employeeId === retired.id)?.workedDays).toBe(10);
      expect(result.period.netTotal).toBe(payments.reduce((t, p) => t + p.net.amount, 0));
    });

    it('applies approved leaves and novelties, and recalculates replacing payslips', async () => {
      const employee = await ctx.addEmployee({ baseSalary: SMMLV });
      const leave = LeaveRequest.create({
        employeeId: employee.id as number,
        leaveType: 'licencia_no_remunerada',
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        reason: 'Personal',
        requestedBy: 1,
      });
      leave.approve(1, new Date());
      await ctx.leaves.save(leave);
      const { id } = await createPeriod();
      await addNovelty(id, employee.id as number, 'bonus_salary' as never, 100_000);

      await calculate(id);
      await calculate(id);

      const payments = await ctx.payments.findByPeriod(id);
      expect(payments).toHaveLength(1);
      expect(payments[0].workedDays).toBe(20);
      expect(payments[0].bonuses.amount).toBe(100_000);
      expect(payments[0].basicSalary.amount).toBe(1_167_270);
    });

    it('fails without eligible employees and on locked periods', async () => {
      const { id } = await createPeriod();
      await expect(calculate(id)).rejects.toMatchObject({ code: 'NO_ELIGIBLE_EMPLOYEES' });
      await ctx.addEmployee();
      await calculate(id);
      await approve(id);
      await expect(calculate(id)).rejects.toMatchObject({ code: 'PAYROLL_PERIOD_LOCKED' });
    });

    it('reports novelties of employees that left the payroll', async () => {
      const employee = await ctx.addEmployee();
      await ctx.addEmployee();
      const { id } = await createPeriod();
      await addNovelty(id, employee.id as number);
      employee.changeStatus('suspended');
      const result = await calculate(id);
      expect(result.warnings).toEqual([{ employeeId: employee.id, messages: [expect.stringContaining('ignorada')] }]);
    });
  });

  describe('novelties', () => {
    it('rejects novelties for employees outside the payroll and invalidates a calculated period', async () => {
      const contractor = await ctx.addEmployee({ contractType: 'prestacion' });
      const employee = await ctx.addEmployee();
      const { id } = await createPeriod();
      await expect(addNovelty(id, contractor.id as number)).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_IN_PAYROLL' });
      await expect(addNovelty(id, 999)).rejects.toBeInstanceOf(NotFoundError);

      await calculate(id);
      const novelty = await addNovelty(id, employee.id as number);
      expect((await ctx.periods.findById(id))?.status).toBe('draft');

      await calculate(id);
      const remove = new RemovePayrollNoveltyUseCase(ctx.periods, ctx.novelties, ctx.uow);
      await expect(remove.execute({ periodId: id + 1, noveltyId: novelty.id })).rejects.toBeInstanceOf(NotFoundError);
      await remove.execute({ periodId: id, noveltyId: novelty.id });
      expect(await ctx.novelties.findByPeriod(id)).toHaveLength(0);
      expect((await ctx.periods.findById(id))?.status).toBe('draft');
    });
  });

  describe('approval, payment and cancellation', () => {
    it('enforces segregation of duties for HR but not for admins', async () => {
      await ctx.addEmployee();
      const { id } = await createPeriod();
      await calculate(id);
      await expect(approve(id, hr)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(approve(id, actor(Role.ADMIN, 1))).resolves.toMatchObject({ status: 'approved' });
    });

    it('pays atomically and publishes hr.payroll-period-paid with the totals', async () => {
      await ctx.addEmployee({ baseSalary: SMMLV });
      const { id } = await createPeriod();
      await calculate(id);
      await approve(id);
      ctx.uow.transactions = 0;

      const view = await pay(id);

      expect(view.status).toBe('paid');
      expect(ctx.uow.transactions).toBe(1);
      expect((await ctx.payments.findByPeriod(id)).every((p) => p.status === 'paid')).toBe(true);
      expect(ctx.events.published).toEqual([
        expect.objectContaining({
          name: 'hr.payroll-period-paid',
          payload: {
            periodId: id,
            periodName: 'Nómina marzo 2026',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
            grossTotal: 2_000_000,
            deductionsTotal: 140_072,
            netTotal: 1_859_928,
          },
        }),
      ]);
    });

    it('does not pay a period that is not approved', async () => {
      const { id } = await createPeriod();
      await expect(pay(id)).rejects.toMatchObject({ code: 'INVALID_PAYROLL_PERIOD_STATUS' });
      expect(ctx.events.published).toHaveLength(0);
    });

    it('cancels editable periods keeping the payslips as cancelled', async () => {
      await ctx.addEmployee();
      const { id } = await createPeriod();
      await calculate(id);
      const view = await new CancelPayrollPeriodUseCase(ctx.periods, ctx.payments, ctx.uow, ctx.clock).execute({
        periodId: id,
        reason: 'Fechas erradas',
      });
      expect(view.status).toBe('cancelled');
      expect((await ctx.payments.findByPeriod(id)).map((p) => p.status)).toEqual(['cancelled']);
      await expect(createPeriod()).resolves.toMatchObject({ status: 'draft' });
    });
  });

  describe('queries', () => {
    it('returns the detail, list and KPIs', async () => {
      const employee = await ctx.addEmployee({ baseSalary: SMMLV });
      const { id } = await createPeriod();
      await addNovelty(id, employee.id as number);
      await calculate(id);

      const detail = await new GetPayrollPeriodDetailUseCase(
        ctx.periods,
        ctx.payments,
        ctx.novelties,
        ctx.employees,
      ).execute(id);
      expect(detail.payments[0]).toMatchObject({ employeeName: 'Ana Pérez', deductions: { libranza: 50_000 } });
      expect(detail.novelties[0]).toMatchObject({ type: 'libranza', employeeName: 'Ana Pérez' });
      expect(detail.employerCostTotal).toBe(525_657);
      await expect(
        new GetPayrollPeriodDetailUseCase(ctx.periods, ctx.payments, ctx.novelties, ctx.employees).execute(99),
      ).rejects.toBeInstanceOf(NotFoundError);

      const list = await new ListPayrollPeriodsUseCase(ctx.periods).execute({
        criteria: { year: 2026 },
        page: { page: 1, limit: 5 },
      });
      expect(list.total).toBe(1);

      const kpis = new GetPayrollKpisUseCase(ctx.payments);
      await expect(kpis.execute('2026-03')).resolves.toMatchObject({ employees: 1, gross: 2_000_000 });
      await expect(kpis.execute('<script>')).rejects.toMatchObject({ code: 'INVALID_MONTH' });
    });
  });
});
