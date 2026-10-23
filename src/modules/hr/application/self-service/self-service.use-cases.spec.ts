import { ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import type { Employee } from '../../domain/employees/employee.js';
import { LeaveRequest } from '../../domain/leaves/leave-request.js';
import { actor, createHrTestContext, type HrTestContext } from '../../testing/hr-test-context.js';
import { GetMyDashboardUseCase } from './get-my-dashboard.use-case.js';
import { GetMyEmployeeProfileUseCase } from './get-my-employee-profile.use-case.js';
import { UpdateMyContactInfoUseCase } from './update-my-contact-info.use-case.js';

describe('self-service use cases', () => {
  let ctx: HrTestContext;
  let employee: Employee;
  const me = () => actor(Role.TEACHER, employee.userId as number);

  beforeEach(async () => {
    ctx = createHrTestContext();
    employee = await ctx.addEmployee({ hireDate: '2024-01-20', fixedEmbargo: 10_000, bankAccount: '111' });
  });

  it('returns the own profile and refuses unlinked users', async () => {
    const useCase = new GetMyEmployeeProfileUseCase(ctx.currentEmployee);
    await expect(useCase.execute(me())).resolves.toMatchObject({ id: employee.id, code: employee.code });
    await expect(useCase.execute(actor(Role.TEACHER, 404))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('updates only contact data', async () => {
    const view = await new UpdateMyContactInfoUseCase(ctx.employees, ctx.currentEmployee).execute({
      actor: me(),
      contact: { phone: '3110000000', address: 'Carrera 2' },
    });
    expect(view).toMatchObject({ phone: '3110000000', address: 'Carrera 2', bankAccount: { number: '111' } });
    expect(view.recurringDeductions.embargo).toBe(10_000);
  });

  it('computes the dashboard KPIs', async () => {
    const pending = LeaveRequest.create({
      employeeId: employee.id as number,
      leaveType: 'otro',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      reason: 'Cita',
      requestedBy: 1,
    });
    const approved = LeaveRequest.create({
      employeeId: employee.id as number,
      leaveType: 'vacaciones',
      startDate: '2025-12-30',
      endDate: '2026-01-05',
      reason: 'Vacaciones',
      requestedBy: 1,
    });
    approved.approve(1, new Date());
    await ctx.leaves.save(pending);
    await ctx.leaves.save(approved);

    const dashboard = await new GetMyDashboardUseCase(ctx.payments, ctx.leaves, ctx.clock, ctx.currentEmployee).execute(
      me(),
    );

    expect(dashboard).toMatchObject({
      monthsEmployed: 25,
      lastPayslip: null,
      pendingLeaves: 1,
      approvedLeavesThisYear: 1,
      absenceDaysThisYear: 5,
    });
  });
});
