import { StreamableFile } from '@nestjs/common';
import { Role } from '../../../../shared/domain/role.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetIncomeCertificateUseCase } from '../../application/documents/get-income-certificate.use-case.js';
import { RenderIncomeCertificateUseCase } from '../../application/documents/render-income-certificate.use-case.js';
import { IssueEmploymentCertificateUseCase } from '../../application/documents/issue-employment-certificate.use-case.js';
import { ListPayslipsUseCase } from '../../application/documents/list-payslips.use-case.js';
import { ChangeEmployeeStatusUseCase } from '../../application/employees/change-employee-status.use-case.js';
import { GetEmployeeKpisUseCase } from '../../application/employees/get-employee-kpis.use-case.js';
import { GetEmployeeUseCase } from '../../application/employees/get-employee.use-case.js';
import { ListEmployeesUseCase } from '../../application/employees/list-employees.use-case.js';
import { RegisterEmployeeUseCase } from '../../application/employees/register-employee.use-case.js';
import { RetireEmployeeUseCase } from '../../application/employees/retire-employee.use-case.js';
import { UpdateEmployeeUseCase } from '../../application/employees/update-employee.use-case.js';
import { buildController, rolesOf } from '../../testing/controller-test-utils.js';
import { actor } from '../../testing/hr-test-context.js';
import { validEmployeeData } from '../../testing/fixtures.js';
import { ListEmployeesQueryDto, RegisterEmployeeDto } from './dto/employee.dto.js';
import { EmployeesController } from './employees.controller.js';

describe('EmployeesController', () => {
  const hr = actor(Role.HR);
  let ctx: Awaited<ReturnType<typeof buildController<EmployeesController>>>;

  beforeEach(async () => {
    ctx = await buildController(EmployeesController, [
      ListEmployeesUseCase,
      GetEmployeeKpisUseCase,
      RegisterEmployeeUseCase,
      GetEmployeeUseCase,
      UpdateEmployeeUseCase,
      ChangeEmployeeStatusUseCase,
      RetireEmployeeUseCase,
      ListPayslipsUseCase,
      IssueEmploymentCertificateUseCase,
      GetIncomeCertificateUseCase,
      RenderIncomeCertificateUseCase,
    ]);
  });

  it('restricts the directory to admin/HR and payslip history to payroll viewers', () => {
    expect(rolesOf(EmployeesController, 'list')).toEqual([Role.ADMIN, Role.HR]);
    expect(rolesOf(EmployeesController, 'payslips')).toEqual([Role.ADMIN, Role.HR, Role.FINANCE]);
    expect(rolesOf(EmployeesController, 'income')).toEqual([Role.ADMIN, Role.HR, Role.FINANCE]);
    expect(rolesOf(EmployeesController, 'incomeDocument')).toEqual([Role.ADMIN, Role.HR, Role.FINANCE]);
  });

  it('lists with filters and paging', async () => {
    const query = Object.assign(new ListEmployeesQueryDto(), {
      search: 'ana',
      type: 'docente',
      status: 'active',
      page: 2,
      limit: 5,
    });
    await ctx.controller.list(query);
    expect(ctx.mock(ListEmployeesUseCase).execute).toHaveBeenCalledWith({
      criteria: { search: 'ana', type: 'docente', status: 'active' },
      page: { page: 2, limit: 5 },
    });
  });

  it('registers separating the account flag from the data', async () => {
    const dto = Object.assign(new RegisterEmployeeDto(), validEmployeeData(), { createUserAccount: false });
    await ctx.controller.register(dto);
    const { data, createUserAccount } = ctx.mock(RegisterEmployeeUseCase).execute.mock.calls[0][0];
    expect(createUserAccount).toBe(false);
    expect(data).not.toHaveProperty('createUserAccount');
  });

  it('delegates the remaining endpoints', async () => {
    await expect(ctx.controller.kpis()).resolves.toEqual({ ok: 'GetEmployeeKpisUseCase' });
    await ctx.controller.get(3);
    expect(ctx.mock(GetEmployeeUseCase).execute).toHaveBeenCalledWith(3);
    await ctx.controller.update(3, validEmployeeData() as never);
    expect(ctx.mock(UpdateEmployeeUseCase).execute).toHaveBeenCalledWith({ employeeId: 3, data: expect.any(Object) });
    await ctx.controller.status(hr, 3, { status: 'suspended' });
    expect(ctx.mock(ChangeEmployeeStatusUseCase).execute).toHaveBeenCalledWith({
      actor: hr,
      employeeId: 3,
      status: 'suspended',
    });
    await ctx.controller.retire(hr, 3, { retirementDate: '2026-03-31', reason: 'Renuncia' });
    expect(ctx.mock(RetireEmployeeUseCase).execute).toHaveBeenCalledWith({
      actor: hr,
      employeeId: 3,
      retirementDate: '2026-03-31',
      reason: 'Renuncia',
    });
    await ctx.controller.payslips(hr, 3, new PaginationQueryDto());
    expect(ctx.mock(ListPayslipsUseCase).execute).toHaveBeenCalledWith({
      actor: hr,
      employeeId: 3,
      page: { page: 1, limit: 20 },
    });
    await ctx.controller.certificate(hr, 3, {});
    expect(ctx.mock(IssueEmploymentCertificateUseCase).execute).toHaveBeenCalledWith({
      actor: hr,
      employeeId: 3,
      includeSalary: true,
      addressee: undefined,
    });
    await ctx.controller.income(hr, 3, { year: 2025 });
    expect(ctx.mock(GetIncomeCertificateUseCase).execute).toHaveBeenCalledWith({
      actor: hr,
      employeeId: 3,
      year: 2025,
    });
    ctx
      .mock(RenderIncomeCertificateUseCase)
      .execute.mockResolvedValue({ contentType: 'application/pdf', fileName: 'i.pdf', body: Buffer.from('%PDF') });
    const res = { setHeader: vi.fn() };
    const file = await ctx.controller.incomeDocument(hr, 3, { year: 2025 }, res as never);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({ type: 'application/pdf', length: 4 });
    expect(ctx.mock(RenderIncomeCertificateUseCase).execute).toHaveBeenCalledWith({
      actor: hr,
      employeeId: 3,
      year: 2025,
    });
  });
});
