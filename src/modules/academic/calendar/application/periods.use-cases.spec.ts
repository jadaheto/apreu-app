import { AcademicWorld } from '../../common/testing/academic-world.js';
import { ClosePeriodUseCase, PERIOD_CLOSED_EVENT } from './close-period.use-case.js';
import { CreatePeriodUseCase } from './create-period.use-case.js';
import { DeletePeriodUseCase } from './delete-period.use-case.js';
import { ListPeriodsUseCase } from './list-periods.use-case.js';
import { ReopenPeriodUseCase } from './reopen-period.use-case.js';
import { UpdatePeriodUseCase } from './update-period.use-case.js';

describe('period use cases', () => {
  let w: AcademicWorld;
  const create = (input: { name: string; startDate: string; endDate: string; academicYear?: number }) =>
    new CreatePeriodUseCase(w.periods, w.settings).execute(input);

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
  });

  it('creates periods keeping at most one open per year (B19)', async () => {
    const second = await create({ name: 'Segundo', startDate: '2026-04-16', endDate: '2026-06-30' });
    expect(second).toMatchObject({ status: 'closed', academicYear: 2026, acceptsGrades: false });
    const nextYear = await create({
      name: 'Primero',
      startDate: '2027-02-01',
      endDate: '2027-04-01',
      academicYear: 2027,
    });
    expect(nextYear.status).toBe('open');
  });

  it('rejects overlapping periods', async () => {
    await expect(create({ name: 'Cruce', startDate: '2026-04-01', endDate: '2026-05-01' })).rejects.toMatchObject({
      code: 'PERIOD_OVERLAP',
    });
  });

  it('lists the periods of the current year', async () => {
    await create({ name: 'Segundo', startDate: '2026-04-16', endDate: '2026-06-30' });
    const periods = await new ListPeriodsUseCase(w.periods, w.settings).execute({});
    expect(periods.map((p) => p.name)).toEqual(['Primer Período', 'Segundo']);
    expect(await new ListPeriodsUseCase(w.periods, w.settings).execute({ year: 2020 })).toEqual([]);
  });

  it('reschedules only its own period (no update without WHERE: B2)', async () => {
    const second = await create({ name: 'Segundo', startDate: '2026-04-16', endDate: '2026-06-30' });
    const updated = await new UpdatePeriodUseCase(w.periods).execute({
      periodId: second.id,
      name: 'Segundo Período',
      startDate: '2026-04-20',
      endDate: '2026-06-30',
    });
    expect(updated.name).toBe('Segundo Período');
    expect((await w.periods.findById(1))?.name).toBe('Primer Período');
    await expect(
      new UpdatePeriodUseCase(w.periods).execute({
        periodId: second.id,
        name: 'X',
        startDate: '2026-03-01',
        endDate: '2026-06-30',
      }),
    ).rejects.toMatchObject({ code: 'PERIOD_OVERLAP' });
  });

  it('closes a period and publishes academic.period-closed', async () => {
    const view = await new ClosePeriodUseCase(w.periods, w.events, w.clock).execute(1);
    expect(view).toMatchObject({ status: 'closed', closedAt: w.clock.now() });
    expect(w.events.published).toEqual([
      {
        name: PERIOD_CLOSED_EVENT,
        occurredAt: w.clock.now(),
        payload: { periodId: 1, name: 'Primer Período', academicYear: 2026 },
      },
    ]);
  });

  it('reopens a period closing the open one of the same year', async () => {
    const second = await create({ name: 'Segundo', startDate: '2026-04-16', endDate: '2026-06-30' });
    const reopened = await new ReopenPeriodUseCase(w.periods, w.uow, w.clock).execute(second.id);
    expect(reopened.status).toBe('open');
    expect((await w.periods.findById(1))?.status).toBe('closed');
    expect(w.uow.transactions).toBe(1);
  });

  it('deletes only periods without grades', async () => {
    w.periods.graded.add(1);
    const remove = new DeletePeriodUseCase(w.periods);
    await expect(remove.execute(1)).rejects.toMatchObject({ code: 'CONFLICT' });
    const second = await create({ name: 'Segundo', startDate: '2026-04-16', endDate: '2026-06-30' });
    await remove.execute(second.id);
    expect(await w.periods.findById(second.id)).toBeNull();
    await expect(remove.execute(77)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
