import { StreamableFile } from '@nestjs/common';
import { Role } from '../../../../shared/domain/role.js';
import { GetPayslipUseCase } from '../../application/documents/get-payslip.use-case.js';
import { RenderPayslipUseCase } from '../../application/documents/render-payslip.use-case.js';
import { ApprovePayrollPeriodUseCase } from '../../application/payroll/approve-payroll-period.use-case.js';
import { CalculatePayrollPeriodUseCase } from '../../application/payroll/calculate-payroll-period.use-case.js';
import { CancelPayrollPeriodUseCase } from '../../application/payroll/cancel-payroll-period.use-case.js';
import { ConfigurePayrollParametersUseCase } from '../../application/payroll/configure-payroll-parameters.use-case.js';
import { CreatePayrollPeriodUseCase } from '../../application/payroll/create-payroll-period.use-case.js';
import { GetPayrollKpisUseCase } from '../../application/payroll/get-payroll-kpis.use-case.js';
import { GetPayrollParametersUseCase } from '../../application/payroll/get-payroll-parameters.use-case.js';
import { GetPayrollPeriodDetailUseCase } from '../../application/payroll/get-payroll-period-detail.use-case.js';
import { ListPayrollPeriodsUseCase } from '../../application/payroll/list-payroll-periods.use-case.js';
import { PayPayrollPeriodUseCase } from '../../application/payroll/pay-payroll-period.use-case.js';
import { RegisterPayrollNoveltyUseCase } from '../../application/payroll/register-payroll-novelty.use-case.js';
import { RemovePayrollNoveltyUseCase } from '../../application/payroll/remove-payroll-novelty.use-case.js';
import { buildController, rolesOf } from '../../testing/controller-test-utils.js';
import { actor } from '../../testing/hr-test-context.js';
import { ListPayrollPeriodsQueryDto } from './dto/payroll.dto.js';
import { PayrollParametersController } from './payroll-parameters.controller.js';
import { PayrollPeriodsController } from './payroll-periods.controller.js';
import { PayslipsController } from './payslips.controller.js';

const admin = actor(Role.ADMIN);

describe('PayrollParametersController', () => {
  it('lets payroll viewers read and only admins configure', async () => {
    expect(rolesOf(PayrollParametersController, 'get')).toEqual([Role.ADMIN, Role.HR, Role.FINANCE]);
    expect(rolesOf(PayrollParametersController, 'configure')).toEqual([Role.ADMIN]);
    const ctx = await buildController(PayrollParametersController, [
      GetPayrollParametersUseCase,
      ConfigurePayrollParametersUseCase,
    ]);
    await ctx.controller.get(2026);
    expect(ctx.mock(GetPayrollParametersUseCase).execute).toHaveBeenCalledWith(2026);
    const values = { minimumWage: 1, transportAllowance: 1, uvt: 1 };
    await ctx.controller.configure(admin, 2027, values);
    expect(ctx.mock(ConfigurePayrollParametersUseCase).execute).toHaveBeenCalledWith({
      actor: admin,
      year: 2027,
      values,
    });
  });
});

describe('PayrollPeriodsController', () => {
  let ctx: Awaited<ReturnType<typeof buildController<PayrollPeriodsController>>>;

  beforeEach(async () => {
    ctx = await buildController(PayrollPeriodsController, [
      ListPayrollPeriodsUseCase,
      GetPayrollKpisUseCase,
      CreatePayrollPeriodUseCase,
      GetPayrollPeriodDetailUseCase,
      RegisterPayrollNoveltyUseCase,
      RemovePayrollNoveltyUseCase,
      CalculatePayrollPeriodUseCase,
      ApprovePayrollPeriodUseCase,
      PayPayrollPeriodUseCase,
      CancelPayrollPeriodUseCase,
    ]);
  });

  it('applies the role matrix of analysis §6.5', () => {
    expect(rolesOf(PayrollPeriodsController, 'create')).toEqual([Role.ADMIN, Role.HR]);
    expect(rolesOf(PayrollPeriodsController, 'detail')).toEqual([Role.ADMIN, Role.HR, Role.FINANCE]);
    expect(rolesOf(PayrollPeriodsController, 'pay')).toEqual([Role.ADMIN, Role.FINANCE]);
    expect(rolesOf(PayrollPeriodsController, 'approve')).toEqual([Role.ADMIN, Role.HR]);
  });

  it('delegates every endpoint', async () => {
    await ctx.controller.list(Object.assign(new ListPayrollPeriodsQueryDto(), { year: 2026 }));
    expect(ctx.mock(ListPayrollPeriodsUseCase).execute).toHaveBeenCalledWith({
      criteria: { year: 2026, status: undefined },
      page: { page: 1, limit: 20 },
    });
    await ctx.controller.kpis({ month: '2026-03' });
    expect(ctx.mock(GetPayrollKpisUseCase).execute).toHaveBeenCalledWith('2026-03');
    const period = {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      paymentDate: '2026-03-30',
      frequency: 'monthly' as const,
    };
    await ctx.controller.create(admin, period);
    expect(ctx.mock(CreatePayrollPeriodUseCase).execute).toHaveBeenCalledWith({ actor: admin, ...period });
    await ctx.controller.detail(5);
    expect(ctx.mock(GetPayrollPeriodDetailUseCase).execute).toHaveBeenCalledWith(5);
    await ctx.controller.addNovelty(admin, 5, { employeeId: 2, type: 'libranza', amount: 10 });
    expect(ctx.mock(RegisterPayrollNoveltyUseCase).execute).toHaveBeenCalledWith({
      actor: admin,
      periodId: 5,
      employeeId: 2,
      type: 'libranza',
      amount: 10,
    });
    await ctx.controller.deleteNovelty(5, 9);
    expect(ctx.mock(RemovePayrollNoveltyUseCase).execute).toHaveBeenCalledWith({ periodId: 5, noveltyId: 9 });
    await ctx.controller.calculate(admin, 5);
    expect(ctx.mock(CalculatePayrollPeriodUseCase).execute).toHaveBeenCalledWith({ actor: admin, periodId: 5 });
    await ctx.controller.approve(admin, 5);
    expect(ctx.mock(ApprovePayrollPeriodUseCase).execute).toHaveBeenCalledWith({ actor: admin, periodId: 5 });
    await ctx.controller.pay(5);
    expect(ctx.mock(PayPayrollPeriodUseCase).execute).toHaveBeenCalledWith(5);
    await ctx.controller.cancel(5, { reason: 'error' });
    expect(ctx.mock(CancelPayrollPeriodUseCase).execute).toHaveBeenCalledWith({ periodId: 5, reason: 'error' });
  });
});

describe('PayslipsController', () => {
  it('returns data and the printable document with its headers', async () => {
    const ctx = await buildController(PayslipsController, [GetPayslipUseCase, RenderPayslipUseCase]);
    await ctx.controller.get(admin, 8);
    expect(ctx.mock(GetPayslipUseCase).execute).toHaveBeenCalledWith({ actor: admin, paymentId: 8 });

    ctx
      .mock(RenderPayslipUseCase)
      .execute.mockResolvedValue({ contentType: 'application/pdf', fileName: 'd.pdf', body: '%PDF' });
    const res = { setHeader: vi.fn() };
    const file = await ctx.controller.document(admin, 8, res as never);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({ type: 'application/pdf', disposition: 'inline; filename="d.pdf"' });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });
});
