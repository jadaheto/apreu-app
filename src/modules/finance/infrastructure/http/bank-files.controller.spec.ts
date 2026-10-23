import type { Response } from 'express';
import { GenerateCollectionFileUseCase } from '../../application/generate-collection-file.use-case.js';
import { GeneratePayrollDisbursementFileUseCase } from '../../application/generate-payroll-disbursement-file.use-case.js';
import { BankFilesController } from './bank-files.controller.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';

describe('BankFilesController', () => {
  it('returns the TXT as attachment', async () => {
    const { controller, mock } = await controllerWithMocks(BankFilesController, [
      GenerateCollectionFileUseCase,
      GeneratePayrollDisbursementFileUseCase,
    ]);
    const file = { fileName: 'RECAUDO_X.txt', content: '01…\r\n', records: 3 };
    mock(GenerateCollectionFileUseCase).mockResolvedValue(file);
    mock(GeneratePayrollDisbursementFileUseCase).mockResolvedValue({ ...file, fileName: 'PAGO_X.txt' });
    const res = { setHeader: vi.fn() } as unknown as Response & { setHeader: ReturnType<typeof vi.fn> };

    await expect(controller.collection({ bank: 'asobancaria', month: '2026-03' }, res)).resolves.toBe('01…\r\n');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="RECAUDO_X.txt"');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');

    await controller.payroll({ bank: 'davivienda', periodId: 3 }, res);
    expect(mock(GeneratePayrollDisbursementFileUseCase)).toHaveBeenCalledWith({ bank: 'davivienda', periodId: 3 });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="PAGO_X.txt"');
  });
});
