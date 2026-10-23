import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../../shared/application/ports/clock.port.js';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { Calendar } from '../../../domain/calendar.js';
import type { FinanceSettings, FinanceSettingsPort } from '../../../domain/finance-settings.port.js';
import { isPaymentMethod, PAYMENT_METHODS } from '../../../domain/payment-method.js';
import { ReceiptNumber } from '../../../domain/receipt-number.js';

const KEYS = ['academic_year', 'receipt_prefix', 'payment_methods', 'school_nit', 'school_name'];
const DEFAULT_NIT = '800000000';
const DEFAULT_SCHOOL_NAME = 'Institución Educativa';

/** Reads the finance keys of the `settings` table with legacy defaults. */
@Injectable()
export class SqlFinanceSettings implements FinanceSettingsPort {
  constructor(
    private readonly db: TenantDataSource,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async load(): Promise<FinanceSettings> {
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query('SELECT key, value FROM settings WHERE key = ANY($1)', [KEYS]);
    const value = (key: string) => rows.find((row) => row.key === key)?.value?.trim() || null;
    const year = Number(value('academic_year'));
    const methods = (value('payment_methods') ?? '')
      .split(',')
      .map((method) => method.trim())
      .filter(isPaymentMethod);
    return {
      academicYear: Number.isInteger(year) && year > 2000 ? year : Calendar.year(Calendar.today(this.clock.now())),
      receiptPrefix: ReceiptNumber.normalizePrefix(value('receipt_prefix')),
      enabledPaymentMethods: methods.length > 0 ? methods : [...PAYMENT_METHODS],
      schoolNit: value('school_nit')?.replace(/\D/g, '') || DEFAULT_NIT,
      schoolName: value('school_name') ?? DEFAULT_SCHOOL_NAME,
    };
  }
}
