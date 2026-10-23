import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { FixedClock } from '../../../shared/testing/fakes.js';
import { FakeFinanceSettings, FakePayrollSource } from '../testing/fakes.js';
import { GenerateCollectionFileUseCase } from './generate-collection-file.use-case.js';
import { GeneratePayrollDisbursementFileUseCase } from './generate-payroll-disbursement-file.use-case.js';
import type { ChargeQueriesPort } from './ports/charge-queries.port.js';

const clock = new FixedClock(new Date('2026-03-05T15:00:00Z'));

describe('GenerateCollectionFileUseCase', () => {
  const queries = { collectibleForPeriod: vi.fn() };
  const useCase = new GenerateCollectionFileUseCase(
    queries as unknown as ChargeQueriesPort,
    new FakeFinanceSettings(),
    clock,
  );

  it('aggregates the real pending balance per student (bugs B33/B34)', async () => {
    queries.collectibleForPeriod.mockResolvedValue([
      { chargeId: 1, studentId: 1, documentNumber: '1.012.345', pendingAmount: 238000 },
      { chargeId: 2, studentId: 1, documentNumber: '1.012.345', pendingAmount: 12000 },
      { chargeId: 3, studentId: 2, documentNumber: null, pendingAmount: 100000 },
    ]);
    const file = await useCase.execute({ bank: 'asobancaria', month: '2026-03' });
    const lines = file.content.split('\r\n');
    expect(file).toMatchObject({ fileName: 'RECAUDO_ASOBANCARIA_20260305.txt', records: 2 });
    expect(lines[1]).toBe('02000000000000010123450000000025000020260305' + '0000');
    expect(lines[2].slice(2, 22)).toBe('00000000000000000002');
    expect(lines[3]).toBe('03000000002000000000000350000');
  });

  it('fails when there is nothing to collect', async () => {
    queries.collectibleForPeriod.mockResolvedValue([]);
    await expect(useCase.execute({ bank: 'asobancaria', month: '2026-03' })).rejects.toMatchObject({
      code: 'NO_RECORDS_FOR_BANK_FILE',
    });
  });
});

describe('GeneratePayrollDisbursementFileUseCase', () => {
  const line = { documentNumber: '1', fullName: 'Ana', bankAccount: '123', accountType: 'ahorros', netSalary: 1000 };

  it('builds the file for closed periods', async () => {
    const file = await new GeneratePayrollDisbursementFileUseCase(
      new FakePayrollSource(undefined, [line]),
      new FakeFinanceSettings(),
      clock,
    ).execute({
      bank: 'bancolombia',
      periodId: 7,
    });
    expect(file).toMatchObject({ fileName: 'PAGO_BANCOLOMBIA_20260305.txt', records: 1 });
    expect(file.content.startsWith('10900123456PAGO NOMINA')).toBe(true);
  });

  it('rejects open, unknown or empty periods (bug B36)', async () => {
    const settings = new FakeFinanceSettings();
    const open = new FakePayrollSource({ id: 7, name: 'x', status: 'open' }, [line]);
    await expect(
      new GeneratePayrollDisbursementFileUseCase(open, settings, clock).execute({ bank: 'bogota', periodId: 7 }),
    ).rejects.toMatchObject({
      code: 'PAYROLL_PERIOD_NOT_CLOSED',
    });
    await expect(
      new GeneratePayrollDisbursementFileUseCase(new FakePayrollSource(), settings, clock).execute({
        bank: 'bogota',
        periodId: 8,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      new GeneratePayrollDisbursementFileUseCase(new FakePayrollSource(), settings, clock).execute({
        bank: 'bogota',
        periodId: 7,
      }),
    ).rejects.toMatchObject({ code: 'NO_RECORDS_FOR_BANK_FILE' });
  });
});
