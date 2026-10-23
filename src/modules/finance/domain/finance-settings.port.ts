import type { PaymentMethod } from './payment-method.js';

/** School settings used by finance (`settings` table, owned by identity/configuration). */
export interface FinanceSettings {
  academicYear: number;
  receiptPrefix: string;
  /** Methods enabled in `settings.payment_methods`; every method when the setting is empty. */
  enabledPaymentMethods: PaymentMethod[];
  /** Digits of the school's NIT. */
  schoolNit: string;
  schoolName: string;
}

export interface FinanceSettingsPort {
  load(): Promise<FinanceSettings>;
}

export const FINANCE_SETTINGS = Symbol('FinanceSettingsPort');
