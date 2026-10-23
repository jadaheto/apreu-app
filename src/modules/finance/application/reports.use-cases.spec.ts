import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { FixedClock } from '../../../shared/testing/fakes.js';
import type { OverdueCharge } from '../domain/aging.js';
import { GetAgingReportUseCase } from './get-aging-report.use-case.js';
import { GetChargesSummaryUseCase } from './get-charges-summary.use-case.js';
import { GetFinanceDashboardUseCase, percentChange } from './get-finance-dashboard.use-case.js';
import { GetReconciliationUseCase } from './get-reconciliation.use-case.js';
import { ListChargesUseCase } from './list-charges.use-case.js';
import type { AgingSourcePort } from './ports/aging-source.port.js';
import type { ChargeQueriesPort } from './ports/charge-queries.port.js';
import type { DashboardQueriesPort } from './ports/dashboard-queries.port.js';
import type { PaymentListItem, PaymentQueriesPort } from './ports/payment-queries.port.js';

const clock = new FixedClock(new Date('2026-06-01T15:00:00Z'));

describe('GetAgingReportUseCase', () => {
  const row = (studentId: number, dueDate: string, pending: number): OverdueCharge => ({
    studentId,
    studentName: `A${studentId}`,
    studentCode: `C${studentId}`,
    gradeId: 1,
    gradeName: 'Primero',
    classroomName: '1A',
    dueDate,
    pending: Money.of(pending),
  });
  const source = {
    overdueCharges: vi
      .fn()
      .mockResolvedValue([row(1, '2026-01-15', 100), row(2, '2026-05-20', 50), row(3, '2026-03-20', 80)]),
  };
  const useCase = new GetAgingReportUseCase(source as AgingSourcePort, clock);

  it('returns KPIs for every risk and filters the list by risk', async () => {
    const report = await useCase.execute({ risk: 'bajo', gradeId: 1 });
    expect(source.overdueCharges).toHaveBeenCalledWith({ today: '2026-06-01', gradeId: 1 });
    expect(report.total).toEqual({ debtors: 3, balance: 230 });
    expect(report.byRisk).toMatchObject({
      critico: { debtors: 1, balance: 100 },
      alto: { debtors: 1 },
      bajo: { debtors: 1 },
    });
    expect(report.debtors).toEqual([expect.objectContaining({ position: 1, studentId: 2, risk: 'bajo', balance: 50 })]);
  });

  it('numbers all debtors when not filtered', async () => {
    const report = await useCase.execute({});
    expect(report.debtors.map((debtor) => [debtor.position, debtor.studentId])).toEqual([
      [1, 1],
      [2, 3],
      [3, 2],
    ]);
  });
});

describe('GetFinanceDashboardUseCase', () => {
  it('computes KPIs for the month and the previous one', async () => {
    const queries = {
      income: vi.fn().mockResolvedValueOnce(1200).mockResolvedValueOnce(1000),
      expenses: vi.fn().mockResolvedValueOnce(500).mockResolvedValueOnce(0),
      overduePortfolio: vi.fn().mockResolvedValue({ balance: 300, debtors: 2 }),
      chargesByCategory: vi.fn().mockResolvedValue([{ category: 'pension', total: 900 }]),
      topExpenseCategories: vi.fn().mockResolvedValue([]),
      latestInvoices: vi.fn().mockResolvedValue([]),
    };
    const view = await new GetFinanceDashboardUseCase(queries as unknown as DashboardQueriesPort, clock).execute({
      month: '2026-03',
    });
    expect(queries.income).toHaveBeenNthCalledWith(1, '2026-03-01', '2026-04-01');
    expect(queries.income).toHaveBeenNthCalledWith(2, '2026-02-01', '2026-03-01');
    expect(queries.overduePortfolio).toHaveBeenCalledWith('2026-06-01');
    expect(queries.topExpenseCategories).toHaveBeenCalledWith('2026-03-01', '2026-04-01', 5);
    expect(view).toMatchObject({
      month: '2026-03',
      income: { value: 1200, previous: 1000, changePct: 20 },
      expenses: { value: 500, previous: 0, changePct: null },
      netProfit: 700,
      overduePortfolio: { balance: 300, debtors: 2 },
    });
  });

  it('percentChange follows the legacy formula', () => {
    expect(percentChange(3, 4)).toBe(33.3);
    expect(percentChange(0, 4)).toBeNull();
  });
});

describe('GetReconciliationUseCase', () => {
  const payment = (id: number, amount: number, method: PaymentListItem['method'], reconciled: boolean) =>
    ({ id, amount, method, reconciled }) as PaymentListItem;

  it('computes totals and the top 3 channels', async () => {
    const queries = {
      forReconciliation: vi
        .fn()
        .mockResolvedValue([
          payment(1, 100, 'efectivo', false),
          payment(2, 500, 'nequi', true),
          payment(3, 300, 'transferencia', true),
          payment(4, 50, 'pse', false),
          payment(5, 200, 'efectivo', false),
        ]),
    };
    const view = await new GetReconciliationUseCase(queries as unknown as PaymentQueriesPort, clock).execute({});
    expect(view.month).toBe('2026-06');
    expect(view.total).toEqual({ count: 5, amount: 1150 });
    expect(view.reconciled).toEqual({ count: 2, amount: 800 });
    expect(view.pending).toEqual({ count: 3, amount: 350 });
    expect(view.byMethod.map((item) => [item.method, item.count, item.amount])).toEqual([
      ['nequi', 1, 500],
      ['efectivo', 2, 300],
      ['transferencia', 1, 300],
    ]);
  });
});

describe('charge listing queries', () => {
  const queries = {
    search: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    summary: vi.fn().mockResolvedValue([
      {
        conceptId: 1,
        conceptName: 'Pensión',
        period: '2026-03',
        chargesCount: 4,
        totalNet: 400,
        totalPaid: 300,
        paidCount: 3,
      },
      {
        conceptId: 1,
        conceptName: 'Pensión',
        period: '2026-02',
        chargesCount: 0,
        totalNet: 0,
        totalPaid: 0,
        paidCount: 0,
      },
    ]),
  };

  it('passes today to the search and validates the period', async () => {
    const useCase = new ListChargesUseCase(queries as unknown as ChargeQueriesPort, clock);
    await useCase.execute({ criteria: { overdueOnly: true }, page: { page: 1, limit: 20 } });
    expect(queries.search).toHaveBeenCalledWith({ overdueOnly: true, today: '2026-06-01' }, { page: 1, limit: 20 });
    await expect(
      useCase.execute({ criteria: { period: '2026-13' }, page: { page: 1, limit: 20 } }),
    ).rejects.toMatchObject({
      code: 'INVALID_PERIOD',
    });
  });

  it('adds collection rates to the summary', async () => {
    const rows = await new GetChargesSummaryUseCase(queries as unknown as ChargeQueriesPort).execute({ limit: 20 });
    expect(rows[0]).toMatchObject({ paidRate: 75, collectedRate: 75 });
    expect(rows[1]).toMatchObject({ paidRate: 0, collectedRate: 0 });
  });
});
