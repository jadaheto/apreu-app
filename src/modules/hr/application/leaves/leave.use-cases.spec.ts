import { ConflictError, ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import type { Employee } from '../../domain/employees/employee.js';
import { LeaveRequest } from '../../domain/leaves/leave-request.js';
import { actor, createHrTestContext, type HrTestContext } from '../../testing/hr-test-context.js';
import { ApproveLeaveUseCase } from './approve-leave.use-case.js';
import { CancelLeaveUseCase } from './cancel-leave.use-case.js';
import { ListLeavesUseCase } from './list-leaves.use-case.js';
import { ListMyLeavesUseCase } from './list-my-leaves.use-case.js';
import { RejectLeaveUseCase } from './reject-leave.use-case.js';
import { RequestLeaveUseCase } from './request-leave.use-case.js';

describe('leave use cases', () => {
  let ctx: HrTestContext;
  let teacher: Employee;
  const hr = actor(Role.HR, 1);
  const teacherActor = () => actor(Role.TEACHER, teacher.userId as number);
  const request = (by = teacherActor(), overrides: Record<string, unknown> = {}) =>
    new RequestLeaveUseCase(ctx.leaves, ctx.clock, ctx.currentEmployee).execute({
      actor: by,
      leaveType: 'calamidad',
      startDate: '2026-03-20',
      endDate: '2026-03-21',
      reason: 'Calamidad doméstica',
      ...overrides,
    });
  const approve = (leaveId: number, by = hr) =>
    new ApproveLeaveUseCase(ctx.leaves, ctx.employees, ctx.clock, ctx.events as never).execute({ actor: by, leaveId });

  beforeEach(async () => {
    ctx = createHrTestContext();
    teacher = await ctx.addEmployee();
  });

  describe('RequestLeaveUseCase', () => {
    it('registers a pending request for the signed-in employee', async () => {
      const view = await request();
      expect(view).toMatchObject({ status: 'pending', days: 2, employeeName: 'Ana Pérez', employeeId: teacher.id });
    });

    it('rejects overlapping requests', async () => {
      await request();
      await expect(request(teacherActor(), { startDate: '2026-03-21', endDate: '2026-03-25' })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('lets only HR request on behalf of another employee', async () => {
      const other = await ctx.addEmployee({ firstName: 'Luis' });
      await expect(request(teacherActor(), { employeeId: other.id })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(request(hr, { employeeId: other.id })).resolves.toMatchObject({ employeeName: 'Luis Pérez' });
    });

    it('requires a linked, current employee', async () => {
      await expect(request(actor(Role.TEACHER, 999))).rejects.toBeInstanceOf(ForbiddenError);
      teacher.retire('2026-03-01', 'Renuncia');
      await expect(request()).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_ACTIVE' });
    });
  });

  describe('approval workflow', () => {
    it('approves, publishes hr.leave-approved and refuses self decisions', async () => {
      const { id } = await request();
      await expect(approve(id, teacherActor())).rejects.toBeInstanceOf(ForbiddenError);
      const view = await approve(id);
      expect(view.status).toBe('approved');
      expect(ctx.events.published[0]).toMatchObject({
        name: 'hr.leave-approved',
        payload: { leaveId: id, employeeId: teacher.id, leaveType: 'calamidad' },
      });
      await expect(approve(404)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects with a reason', async () => {
      const { id } = await request();
      const view = await new RejectLeaveUseCase(ctx.leaves, ctx.employees, ctx.clock).execute({
        actor: hr,
        leaveId: id,
        reason: 'Sin soporte',
      });
      expect(view).toMatchObject({ status: 'rejected', decisionNote: 'Sin soporte' });
    });

    it('does not approve a request overlapping an approved one (legacy data)', async () => {
      const first = await request();
      await approve(first.id);
      const legacy = LeaveRequest.restore(50, {
        employeeId: teacher.id as number,
        leaveType: 'vacaciones',
        startDate: '2026-03-21',
        endDate: '2026-03-22',
        reason: 'Migrado',
        status: 'pending',
        requestedBy: null,
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        createdAt: null,
      });
      await ctx.leaves.save(legacy);
      await expect(approve(50)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('CancelLeaveUseCase', () => {
    const cancel = (leaveId: number, by: ReturnType<typeof actor>) =>
      new CancelLeaveUseCase(ctx.leaves, ctx.clock, ctx.currentEmployee).execute({ actor: by, leaveId });

    it("lets the owner cancel a pending request but hides other employees' requests", async () => {
      const other = await ctx.addEmployee({ firstName: 'Luis' });
      const foreign = await request(hr, { employeeId: other.id });
      await expect(cancel(foreign.id, teacherActor())).rejects.toBeInstanceOf(NotFoundError);
      const own = await request();
      await expect(cancel(own.id, teacherActor())).resolves.toMatchObject({ status: 'cancelled' });
    });

    it('lets HR cancel an approved leave that has not finished', async () => {
      const { id } = await request();
      await approve(id);
      await expect(cancel(id, teacherActor())).rejects.toMatchObject({ code: 'LEAVE_NOT_CANCELLABLE' });
      await expect(cancel(id, hr)).resolves.toMatchObject({ status: 'cancelled' });
    });
  });

  describe('lists', () => {
    it('lists all requests for HR with names and the own requests for the employee', async () => {
      const other = await ctx.addEmployee({ firstName: 'Luis' });
      await request();
      await request(hr, { employeeId: other.id });
      const all = await new ListLeavesUseCase(ctx.leaves, ctx.employees, ctx.clock).execute({
        criteria: { status: 'pending' },
        page: { page: 1, limit: 10 },
      });
      expect(all.items.map((l) => l.employeeName).sort()).toEqual(['Ana Pérez', 'Luis Pérez']);
      const mine = await new ListMyLeavesUseCase(ctx.leaves, ctx.clock, ctx.currentEmployee).execute({
        actor: teacherActor(),
        page: { page: 1, limit: 10 },
      });
      expect(mine.total).toBe(1);
    });
  });
});
