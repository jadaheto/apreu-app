import { Role } from '../../../shared/domain/role.js';
import { FixedClock } from '../../../shared/testing/fakes.js';
import { StubAdminDashboardQueries } from '../testing/stub-admin-dashboard-queries.js';
import { GetAdminDashboardUseCase } from './get-admin-dashboard.use-case.js';

describe('GetAdminDashboardUseCase', () => {
  let queries: StubAdminDashboardQueries;
  // 2026-03-15 22:30 in Bogotá is already 2026-03-16 in UTC.
  const clock = new FixedClock(new Date('2026-03-16T03:30:00Z'));
  const run = (role: Role) => new GetAdminDashboardUseCase(queries, clock).execute(role);
  const called = () => queries.calls.map((call) => call.method);

  beforeEach(() => {
    queries = new StubAdminDashboardQueries();
    queries.revenue.set('2026-03-15', { total: 450_000, count: 2 });
    queries.revenue.set('2026-03-01', { total: 1_000_000, count: 3 });
    queries.monthly = [
      { month: '2025-11', total: 200_000 },
      { month: '2026-03', total: 1_000_000 },
    ];
    queries.debtors = [
      {
        studentId: 1,
        studentName: 'Ana',
        studentCode: 'A1',
        gradeName: '5°',
        balance: 900_000,
        oldestDueDate: '2025-12-01',
      },
      {
        studentId: 2,
        studentName: 'Luis',
        studentCode: 'L1',
        gradeName: null,
        balance: 100_000,
        oldestDueDate: '2026-03-01',
      },
    ];
    queries.levels = [{ level: 'primaria', total: 80 }];
  });

  it('builds every widget for the administrator using the Colombian day', async () => {
    const view = await run(Role.ADMIN);
    expect(view).toMatchObject({
      today: '2026-03-15',
      academicYear: 2026,
      students: { active: 120, total: 130, byLevel: [{ level: 'primaria', total: 80 }] },
      staff: { activeEmployees: 25 },
      incidents: { pending: 4 },
    });
    expect(view.finance).toMatchObject({
      todayRevenue: { amount: 450_000, payments: 2 },
      overdue: { amount: 1_500_000, debtors: 3 },
      averageTicket: { amount: 333_333.33, month: '2026-03' },
    });
    expect(queries.calls).toContainEqual({ method: 'revenueBetween', args: ['2026-03-15', '2026-03-16'] });
    expect(queries.calls).toContainEqual({ method: 'revenueBetween', args: ['2026-03-01', '2026-04-01'] });
    expect(queries.calls).toContainEqual({ method: 'monthlyRevenue', args: ['2025-10-01', '2026-04-01'] });
    expect(queries.calls).toContainEqual({ method: 'topDebtors', args: ['2026-03-15', 8] });
  });

  it('zero-fills exactly six months with Spanish labels', async () => {
    const { finance } = await run(Role.ADMIN);
    expect(finance?.monthlyRevenue).toEqual([
      { month: '2025-10', label: 'oct', amount: 0 },
      { month: '2025-11', label: 'nov', amount: 200_000 },
      { month: '2025-12', label: 'dic', amount: 0 },
      { month: '2026-01', label: 'ene', amount: 0 },
      { month: '2026-02', label: 'feb', amount: 0 },
      { month: '2026-03', label: 'mar', amount: 1_000_000 },
    ]);
  });

  it('classifies debtors by the age of their oldest overdue charge', async () => {
    const { finance } = await run(Role.FINANCE);
    expect(finance?.topDebtors.map(({ daysOverdue, risk }) => ({ daysOverdue, risk }))).toEqual([
      { daysOverdue: 104, risk: 'critical' },
      { daysOverdue: 14, risk: 'low' },
    ]);
  });

  it('shows finance only the financial and student widgets', async () => {
    const view = await run(Role.FINANCE);
    expect(view.finance).not.toBeNull();
    expect(view.staff).toBeNull();
    expect(view.incidents).toBeNull();
    expect(called()).not.toContain('activeEmployees');
  });

  it('shows HR its widgets without running financial queries', async () => {
    const view = await run(Role.HR);
    expect(view).toMatchObject({ finance: null, staff: { activeEmployees: 25 }, incidents: { pending: 4 } });
    expect(called()).not.toEqual(expect.arrayContaining(['revenueBetween']));
  });

  it('returns a zero average ticket without payments and falls back to the current year', async () => {
    queries.revenue.clear();
    queries.year = null;
    const view = await run(Role.SUPERADMIN);
    expect(view.finance?.averageTicket).toEqual({ amount: 0, month: '2026-03' });
    expect(view.academicYear).toBe(2026);
  });
});
