import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { BankFile, PayrollFileBank } from '../domain/bank-files/bank-file.js';
import { PayrollDisbursementFile } from '../domain/bank-files/payroll-disbursement-file.js';
import { Calendar } from '../domain/calendar.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import {
  PAYROLL_DISBURSEMENT_SOURCE,
  type PayrollDisbursementSourcePort,
} from '../domain/payroll-disbursement-source.port.js';

const DISBURSABLE_STATUSES = ['closed', 'paid'];

/**
 * Payroll disbursement TXT (legacy `finance/bank_files.php`, "dispersión").
 * Only closed or paid periods are allowed (legacy offered open ones, bug B36).
 */
@Injectable()
export class GeneratePayrollDisbursementFileUseCase implements UseCase<
  { bank: PayrollFileBank; periodId: number },
  BankFile
> {
  constructor(
    @Inject(PAYROLL_DISBURSEMENT_SOURCE) private readonly payroll: PayrollDisbursementSourcePort,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ bank, periodId }: { bank: PayrollFileBank; periodId: number }): Promise<BankFile> {
    const period = await this.payroll.findPeriod(periodId);
    if (!period) throw new NotFoundError('Período de nómina', periodId);
    if (!DISBURSABLE_STATUSES.includes(period.status)) {
      throw new BusinessRuleViolationError('El período de nómina no está cerrado.', 'PAYROLL_PERIOD_NOT_CLOSED');
    }
    const lines = await this.payroll.linesOf(periodId);
    if (lines.length === 0) {
      throw new BusinessRuleViolationError('El período no tiene pagos de nómina.', 'NO_RECORDS_FOR_BANK_FILE');
    }
    const today = Calendar.today(this.clock.now());
    const { schoolNit } = await this.settings.load();
    return {
      fileName: `PAGO_${bank.toUpperCase()}_${Calendar.compact(today)}.txt`,
      content: PayrollDisbursementFile.build({ nit: schoolNit, date: today, entries: lines }),
      records: lines.length,
    };
  }
}
