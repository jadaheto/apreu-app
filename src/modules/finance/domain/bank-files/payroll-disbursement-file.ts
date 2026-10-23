import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { BANK_FILE_EOL, FixedWidth } from './fixed-width.js';

export interface PayrollDisbursementEntry {
  documentNumber: string;
  fullName: string;
  bankAccount: string | null;
  accountType: string | null;
  netSalary: number;
}

/**
 * Payroll disbursement flat file, layout documented in analysis §2.7-A:
 *
 * - Header `1` (46): type(1) NIT(10, zeros) "PAGO NOMINA"(24) "220"(3) date YYYYMMDD(8).
 * - Detail `6` (72): document(15) name(30) account(15, zeros) account type(1: 2=corriente, 1=ahorros) net(10, zeros).
 * - Control `8` (22): records(6) total(15).
 *
 * Amounts are whole pesos; the control total is the sum of the rounded
 * details (legacy wrote an unrounded total, bug B30).
 */
export const PayrollDisbursementFile = {
  build(input: { nit: string; date: string; entries: PayrollDisbursementEntry[] }): string {
    const missing = input.entries.filter((entry) => !entry.bankAccount?.replace(/\D/g, ''));
    if (missing.length > 0) {
      throw new BusinessRuleViolationError(
        `Empleados sin cuenta bancaria: ${missing.map((entry) => entry.fullName).join(', ')}.`,
        'EMPLOYEE_WITHOUT_BANK_ACCOUNT',
      );
    }
    const amounts = input.entries.map((entry) => Math.round(entry.netSalary));
    const header =
      '1' +
      FixedWidth.number(input.nit, 10, 'NIT') +
      FixedWidth.text('PAGO NOMINA', 24) +
      '220' +
      input.date.replace(/-/g, '');
    const details = input.entries.map(
      (entry, index) =>
        '6' +
        FixedWidth.code(entry.documentNumber, 15, 'documento') +
        FixedWidth.text(entry.fullName, 30) +
        FixedWidth.number(entry.bankAccount as string, 15, 'cuenta bancaria') +
        (entry.accountType === 'corriente' ? '2' : '1') +
        FixedWidth.number(amounts[index], 10, 'valor neto'),
    );
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const control = '8' + FixedWidth.number(details.length, 6, 'registros') + FixedWidth.number(total, 15, 'total');
    return [header, ...details, control].join(BANK_FILE_EOL) + BANK_FILE_EOL;
  },
};
