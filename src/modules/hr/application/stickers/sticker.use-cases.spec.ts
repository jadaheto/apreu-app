import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import type { Employee } from '../../domain/employees/employee.js';
import { actor, createHrTestContext, type HrTestContext } from '../../testing/hr-test-context.js';
import { CreateStickerUseCase } from './create-sticker.use-case.js';
import { DeleteStickerUseCase } from './delete-sticker.use-case.js';
import { GetStickerStatsUseCase } from './get-sticker-stats.use-case.js';
import { ListMyPendingStickersUseCase } from './list-my-pending-stickers.use-case.js';
import { ListStickersUseCase } from './list-stickers.use-case.js';
import { MarkStickerReadUseCase } from './mark-sticker-read.use-case.js';
import { StickerViewAssembler } from './sticker-view.assembler.js';

describe('sticker use cases', () => {
  let ctx: HrTestContext;
  let ana: Employee;
  let luis: Employee;
  const hr = actor(Role.HR, 1);
  const anaActor = () => actor(Role.TEACHER, ana.userId as number);
  const luisActor = () => actor(Role.EMPLOYEE, luis.userId as number);

  const create = (by: ReturnType<typeof actor>, employeeId: number, priority: 'normal' | 'urgent' = 'normal') =>
    new CreateStickerUseCase(ctx.stickers, ctx.employees, ctx.currentEmployee).execute({
      actor: by,
      employeeId,
      title: 'Entregar notas',
      priority,
    });
  const assembler = () => new StickerViewAssembler(ctx.employees, ctx.users);

  beforeEach(async () => {
    ctx = createHrTestContext();
    ana = await ctx.addEmployee();
    luis = await ctx.addEmployee({ firstName: 'Luis' }, Role.EMPLOYEE);
  });

  it('lets HR assign to anyone and staff only to themselves', async () => {
    await expect(create(hr, luis.id as number)).resolves.toMatchObject({
      employeeName: 'Luis Pérez',
      createdByName: 'Usuario 1',
    });
    await expect(create(anaActor(), ana.id as number)).resolves.toMatchObject({ color: 'yellow' });
    await expect(create(anaActor(), luis.id as number)).rejects.toBeInstanceOf(ForbiddenError);
    luis.changeStatus('suspended');
    await expect(create(hr, luis.id as number)).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_ACTIVE' });
    await expect(create(hr, 999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('scopes lists and stats by role', async () => {
    await create(hr, luis.id as number, 'urgent');
    await create(anaActor(), ana.id as number);
    const list = (by: ReturnType<typeof actor>) =>
      new ListStickersUseCase(ctx.stickers, ctx.currentEmployee, assembler()).execute({
        actor: by,
        filter: 'all',
        page: { page: 1, limit: 10 },
      });
    await expect(list(hr)).resolves.toMatchObject({ total: 2 });
    await expect(list(anaActor())).resolves.toMatchObject({ total: 1 });
    await expect(list(actor(Role.FINANCE, 555))).resolves.toMatchObject({ total: 0 });
    const stats = new GetStickerStatsUseCase(ctx.stickers, ctx.currentEmployee);
    await expect(stats.execute(hr)).resolves.toEqual({ total: 2, unread: 2, urgent: 1 });
    await expect(stats.execute(luisActor())).resolves.toEqual({ total: 1, unread: 1, urgent: 1 });
  });

  it('shows pending stickers to the recipient, who marks them read', async () => {
    const sticker = await create(hr, luis.id as number);
    const pending = new ListMyPendingStickersUseCase(ctx.stickers, ctx.currentEmployee, assembler());
    await expect(pending.execute(luisActor())).resolves.toHaveLength(1);
    await expect(pending.execute(actor(Role.FINANCE, 555))).resolves.toEqual([]);

    const mark = new MarkStickerReadUseCase(ctx.stickers, ctx.clock, ctx.currentEmployee);
    await expect(mark.execute({ actor: anaActor(), stickerId: sticker.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(mark.execute({ actor: luisActor(), stickerId: sticker.id })).resolves.toMatchObject({ isRead: true });
    await expect(pending.execute(luisActor())).resolves.toHaveLength(0);
  });

  it('lets only the author or HR delete', async () => {
    const sticker = await create(anaActor(), ana.id as number);
    const remove = new DeleteStickerUseCase(ctx.stickers);
    await expect(remove.execute({ actor: luisActor(), stickerId: sticker.id })).rejects.toBeInstanceOf(NotFoundError);
    await remove.execute({ actor: anaActor(), stickerId: sticker.id });
    expect(await ctx.stickers.findById(sticker.id)).toBeNull();
  });
});
