import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { SqlAdminDashboardQueries } from './sql-admin-dashboard-queries.js';

describe('SqlAdminDashboardQueries', () => {
  const query = vi.fn();
  const db = { manager: async () => ({ query }) } as unknown as TenantDataSource;
  const adapter = new SqlAdminDashboardQueries(db);

  beforeEach(() => query.mockReset());

  it('converts DECIMAL strings with cent precision and binds the date range', async () => {
    query.mockResolvedValue([{ total: '1250000.10', count: '3' }]);
    await expect(adapter.revenueBetween('2026-03-01', '2026-04-01')).resolves.toEqual({ total: 1_250_000.1, count: 3 });
    expect(query.mock.calls[0]?.[0]).toContain("status = 'applied'");
    expect(query.mock.calls[0]?.[1]).toEqual(['2026-03-01', '2026-04-01']);
  });

  it('ignores reversed payments and zero balances in the overdue portfolio', async () => {
    query.mockResolvedValue([{ total: '500.00', debtors: '1' }]);
    await expect(adapter.overdueSummary('2026-03-15')).resolves.toEqual({ total: 500, debtors: 1 });
    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("p.status <> 'reversed'");
    expect(sql).toContain('> 0');
    expect(query.mock.calls[0]?.[1]).toEqual(['2026-03-15']);
  });

  it('maps debtors and payments', async () => {
    query.mockResolvedValueOnce([
      {
        student_id: 4,
        student_name: 'Ana Ruiz',
        code: 'A4',
        grade_name: null,
        balance: '10.50',
        oldest_due: '2026-01-02',
      },
    ]);
    await expect(adapter.topDebtors('2026-03-15', 8)).resolves.toEqual([
      {
        studentId: 4,
        studentName: 'Ana Ruiz',
        studentCode: 'A4',
        gradeName: null,
        balance: 10.5,
        oldestDueDate: '2026-01-02',
      },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual(['2026-03-15', 8]);
  });

  it('validates the academic year setting', async () => {
    query
      .mockResolvedValueOnce([{ value: ' 2027 ' }])
      .mockResolvedValueOnce([{ value: '' }])
      .mockResolvedValueOnce([]);
    await expect(adapter.academicYear()).resolves.toBe(2027);
    await expect(adapter.academicYear()).resolves.toBeNull();
    await expect(adapter.academicYear()).resolves.toBeNull();
  });

  it('counts with defaults when there are no rows', async () => {
    query.mockResolvedValue([]);
    await expect(adapter.activeEmployees()).resolves.toBe(0);
    await expect(adapter.studentCounts()).resolves.toEqual({ active: 0, total: 0 });
  });
});
