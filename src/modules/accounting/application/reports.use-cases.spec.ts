import { ThirdParty } from '../domain/third-party.js';
import { ACCOUNTANT, createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { CreateJournalEntryUseCase } from './create-journal-entry.use-case.js';
import { ExportReportUseCase } from './export-report.use-case.js';
import { GetAccountingDashboardUseCase } from './get-accounting-dashboard.use-case.js';
import { GetAuxiliaryLedgerUseCase } from './get-auxiliary-ledger.use-case.js';
import { GetBalanceSheetUseCase } from './get-balance-sheet.use-case.js';
import { GetGeneralJournalUseCase } from './get-general-journal.use-case.js';
import { GetGeneralLedgerUseCase } from './get-general-ledger.use-case.js';
import { GetIncomeStatementUseCase } from './get-income-statement.use-case.js';
import { GetTrialBalanceUseCase } from './get-trial-balance.use-case.js';
import type { ReportRendererPort, ReportTable } from './ports/report-renderer.port.js';
import { VoidJournalEntryUseCase } from './void-journal-entry.use-case.js';

describe('report use cases', () => {
  let f: AccountingFixture;
  let id: (code: string) => number;
  let parentId: number;

  const MARCH = { from: '2026-03-01', to: '2026-03-31' };

  beforeEach(async () => {
    f = createAccountingFixture();
    id = await f.seedPuc();
    await f.openPeriod('Febrero', '2026-02-01', '2026-02-28');
    await f.openPeriod();
    const parent = ThirdParty.create({ documentType: 'CC', documentNumber: '52000111', name: 'Acudiente' });
    await f.thirdParties.save(parent);
    parentId = parent.id as number;
    const create = new CreateJournalEntryUseCase(f.booker, f.lookups, f.uow, f.clock);
    const entry = (date: string, type: 'RC' | 'CE' | 'NI', debit: string, credit: string, amount: number, extra = {}) =>
      create.execute({
        date,
        type,
        description: `Asiento ${type}`,
        lines: [
          { accountId: id(debit), debit: amount, ...extra },
          { accountId: id(credit), credit: amount },
        ],
        actor: ACCOUNTANT,
        ...extra,
      });
    await entry('2026-02-01', 'NI', '111005', '3105', 10_000_000);
    await entry('2026-03-10', 'RC', '110505', '413502', 350_000, { thirdPartyId: parentId });
    await entry('2026-03-12', 'CE', '5135', '110505', 85_000);
    const voided = await entry('2026-03-13', 'RC', '110505', '413502', 1_000);
    await new VoidJournalEntryUseCase(f.entries, f.periods, f.clock).execute({
      id: voided.id,
      reason: 'x',
      actor: ACCOUNTANT,
    });
    await entry('2026-03-14', 'RC', '110505', '413502', 7, { postImmediately: false });
  });

  it('trial balance: only posted lines in range, with opening balances (bug 2)', async () => {
    const report = await new GetTrialBalanceUseCase(f.reader).execute(MARCH);
    expect(report.rows.map((r) => [r.code, r.openingBalance, r.debit, r.credit, r.closingBalance])).toEqual([
      ['110505', 0, 350000, 85000, 265000],
      ['111005', 10000000, 0, 0, 10000000],
      ['3105', -10000000, 0, 0, -10000000],
      ['413502', 0, 0, 350000, -350000],
      ['5135', 0, 85000, 0, 85000],
    ]);
    expect(report.totals).toEqual({ debit: 435000, credit: 435000, debitBalance: 10350000, creditBalance: 10350000 });
    expect(report.balanced).toBe(true);
    const byClass = await new GetTrialBalanceUseCase(f.reader).execute({ ...MARCH, level: 1 });
    expect(byClass.rows.map((r) => [r.code, r.name])).toEqual([
      ['1', 'ACTIVOS'],
      ['3', 'PATRIMONIO'],
      ['4', 'INGRESOS'],
      ['5', 'GASTOS'],
    ]);
    await expect(
      new GetTrialBalanceUseCase(f.reader).execute({ from: '2026-03-31', to: '2026-03-01' }),
    ).rejects.toMatchObject({
      code: 'INVERTED_DATES',
    });
  });

  it('income statement includes only the range and fixes the zero totals (bug 3)', async () => {
    const report = await new GetIncomeStatementUseCase(f.reader).execute(MARCH);
    expect(report.income).toEqual({ rows: [{ code: '413502', name: 'Pensiones', amount: 350000 }], total: 350000 });
    expect(report.expenses.total).toBe(85000);
    expect(report.costs.total).toBe(0);
    expect([report.grossProfit, report.netIncome]).toEqual([350000, 265000]);
  });

  it('balance sheet satisfies Activo = Pasivo + Patrimonio', async () => {
    const report = await new GetBalanceSheetUseCase(f.reader).execute('2026-03-31');
    expect(report).toMatchObject({
      periodResult: 265000,
      totalEquity: 10265000,
      totalLiabilitiesAndEquity: 10265000,
      balanced: true,
    });
    expect(report.assets.total).toBe(10265000);
  });

  it('general journal lists posted entries chronologically with range totals', async () => {
    const lookups = f.lookups;
    const report = await new GetGeneralJournalUseCase(f.entries, f.ledger, lookups).execute({
      ...MARCH,
      page: { page: 1, limit: 1 },
    });
    expect(report.entries.total).toBe(2);
    expect(report.entries.items[0]).toMatchObject({ date: '2026-03-10', displayNumber: 'RC-000001' });
    expect(report.entries.items[0].lines).toHaveLength(2);
    expect(report.totals).toEqual({ debit: 435000, credit: 435000 });
  });

  it('general ledger aggregates by 4-digit account or details one account', async () => {
    const useCase = new GetGeneralLedgerUseCase(f.reader, f.accounts, f.ledger);
    const all = await useCase.execute(MARCH);
    expect(all.rows.find((r) => r.code === '3105')).toMatchObject({
      openingBalance: 10000000,
      closingBalance: 10000000,
    });
    expect(all.lines).toBeNull();
    const caja = await useCase.execute({ ...MARCH, accountId: id('1105') });
    expect(caja.rows).toEqual([
      expect.objectContaining({ code: '1105', debit: 350000, credit: 85000, closingBalance: 265000 }),
    ]);
    expect(caja.lines?.map((l) => l.balance)).toEqual([350000, 265000]);
    await expect(useCase.execute({ ...MARCH, accountId: 999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('auxiliary ledger uses opening balance and nature-aware running balance (bug 12)', async () => {
    const useCase = new GetAuxiliaryLedgerUseCase(f.reader, f.accounts, f.ledger);
    const report = await useCase.execute({ from: '2026-03-11', to: '2026-03-31', accountId: id('110505') });
    expect(report).toMatchObject({
      openingBalance: 350000,
      closingBalance: 265000,
      totals: { debit: 0, credit: 85000 },
    });
    expect(report.lines).toEqual([expect.objectContaining({ voucher: 'CE-000001', credit: 85000, balance: 265000 })]);
    const byParty = await useCase.execute({ ...MARCH, accountId: id('110505'), thirdPartyId: parentId });
    expect(byParty.lines).toEqual([expect.objectContaining({ thirdPartyName: 'Acudiente', balance: 350000 })]);
    await expect(useCase.execute({ ...MARCH, accountId: 999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('dashboard shows the month KPIs, latest entries and current period (bug 4)', async () => {
    const report = await new GetAccountingDashboardUseCase(f.reader, f.ledger, f.entries, f.periods, f.clock).execute();
    expect(report).toMatchObject({
      month: '2026-03',
      income: 350000,
      expenses: 85000,
      netIncome: 265000,
      entriesCount: 2,
      currentPeriod: expect.objectContaining({ name: 'Marzo 2026' }),
    });
    expect(report.latestEntries).toHaveLength(5);
  });

  describe('ExportReportUseCase', () => {
    let tables: ReportTable[];
    let exporter: ExportReportUseCase;

    beforeEach(() => {
      tables = [];
      const renderer: ReportRendererPort = {
        render: async (table, format) => {
          tables.push(table);
          return { fileName: `${table.slug}.${format}`, contentType: 'text/csv', content: Buffer.from('') };
        },
      };
      exporter = new ExportReportUseCase(
        new GetTrialBalanceUseCase(f.reader),
        new GetGeneralJournalUseCase(f.entries, f.ledger, f.lookups),
        new GetGeneralLedgerUseCase(f.reader, f.accounts, f.ledger),
        new GetAuxiliaryLedgerUseCase(f.reader, f.accounts, f.ledger),
        new GetIncomeStatementUseCase(f.reader),
        new GetBalanceSheetUseCase(f.reader),
        renderer,
      );
    });

    it.each([
      ['trial-balance', 'balance-de-prueba-2026-03-01_2026-03-31', 6],
      ['journal', 'libro-diario-2026-03-01_2026-03-31', 5],
      ['ledger', 'libro-mayor-2026-03-01_2026-03-31', 5],
      ['income-statement', 'estado-de-resultados-2026-03-01_2026-03-31', 7],
    ] as const)('builds the %s table', async (report, slug, rows) => {
      const file = await exporter.execute({ report, format: 'csv', ...MARCH });
      expect(file.fileName).toBe(`${slug}.csv`);
      expect(tables[0].rows).toHaveLength(rows);
    });

    it('builds auxiliary and balance sheet tables', async () => {
      await exporter.execute({ report: 'auxiliary', format: 'csv', ...MARCH, accountId: id('110505') });
      await exporter.execute({ report: 'balance-sheet', format: 'csv', asOf: '2026-03-31' });
      expect(tables[0].rows).toHaveLength(4);
      expect(tables[1].rows.at(-1)).toEqual([null, null, 'Total pasivo + patrimonio', 10265000]);
    });

    it('requires the parameters of each report', async () => {
      await expect(exporter.execute({ report: 'balance-sheet', format: 'csv' })).rejects.toMatchObject({
        code: 'REQUIRED_FIELD',
      });
      await expect(exporter.execute({ report: 'auxiliary', format: 'csv', ...MARCH })).rejects.toMatchObject({
        code: 'REQUIRED_FIELD',
      });
    });
  });
});
