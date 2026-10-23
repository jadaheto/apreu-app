import { Role } from '../../../../shared/domain/role.js';
import { ApproveLeaveUseCase } from '../../application/leaves/approve-leave.use-case.js';
import { CancelLeaveUseCase } from '../../application/leaves/cancel-leave.use-case.js';
import { ListLeavesUseCase } from '../../application/leaves/list-leaves.use-case.js';
import { RejectLeaveUseCase } from '../../application/leaves/reject-leave.use-case.js';
import { RequestLeaveUseCase } from '../../application/leaves/request-leave.use-case.js';
import { buildController, rolesOf } from '../../testing/controller-test-utils.js';
import { actor } from '../../testing/hr-test-context.js';
import { ListLeavesQueryDto } from './dto/leave.dto.js';
import { LeavesController } from './leaves.controller.js';

describe('LeavesController', () => {
  const hr = actor(Role.HR);
  let ctx: Awaited<ReturnType<typeof buildController<LeavesController>>>;

  beforeEach(async () => {
    ctx = await buildController(LeavesController, [
      ListLeavesUseCase,
      RequestLeaveUseCase,
      ApproveLeaveUseCase,
      RejectLeaveUseCase,
      CancelLeaveUseCase,
    ]);
  });

  it('is restricted to admin and HR', () => {
    expect(rolesOf(LeavesController, 'approve')).toEqual([Role.ADMIN, Role.HR]);
  });

  it('delegates every endpoint', async () => {
    const query = Object.assign(new ListLeavesQueryDto(), { status: 'pending', employeeId: 4, from: '2026-01-01' });
    await ctx.controller.list(query);
    expect(ctx.mock(ListLeavesUseCase).execute).toHaveBeenCalledWith({
      criteria: { status: 'pending', employeeId: 4, from: '2026-01-01', to: undefined },
      page: { page: 1, limit: 20 },
    });
    const dto = {
      employeeId: 4,
      leaveType: 'vacaciones' as const,
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      reason: 'x',
    };
    await ctx.controller.create(hr, dto);
    expect(ctx.mock(RequestLeaveUseCase).execute).toHaveBeenCalledWith({ actor: hr, ...dto });
    await ctx.controller.approve(hr, 7, { note: 'ok' });
    expect(ctx.mock(ApproveLeaveUseCase).execute).toHaveBeenCalledWith({ actor: hr, leaveId: 7, note: 'ok' });
    await ctx.controller.reject(hr, 7, { reason: 'no' });
    expect(ctx.mock(RejectLeaveUseCase).execute).toHaveBeenCalledWith({ actor: hr, leaveId: 7, reason: 'no' });
    await ctx.controller.cancel(hr, 7);
    expect(ctx.mock(CancelLeaveUseCase).execute).toHaveBeenCalledWith({ actor: hr, leaveId: 7 });
  });
});
