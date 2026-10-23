/** A rule key mapped to a PUC account code of {@link STANDARD_PUC}. */
export interface DefaultPostingRule {
  key: string;
  accountCode: string;
}

const CASH = '110505'; // Caja General
const BANK = '111005'; // Cuenta Corriente
const ELECTRONIC_METHODS = [
  'transferencia',
  'transferencia_ext',
  'nequi',
  'daviplata',
  'breb',
  'pse',
  'tarjeta',
  'datafono',
  'cheque',
];

/**
 * Minimal parametrization of automatic entries for a Colombian school, on
 * top of the simplified PUC (`STANDARD_PUC`). The legacy had no automatic
 * accounting (analysis 06 §1: 100 % manual), so these defaults follow the
 * accounts the legacy PUC already offered for each fact:
 *
 * - Cashier receipts (RC): cash payments debit 110505 Caja General, every
 *   electronic channel debits 111005 Bancos; income is credited by concept
 *   category to 4135xx Servicios Educativos (matrícula, pensión, transporte,
 *   certificados), surcharges to 4210 and the surplus not applied to charges
 *   to 2805 Anticipos recibidos.
 * - Expenses (CE): 5195 Gastos diversos against 110505 Caja (refine per
 *   category with `expense.debit.category.<id>`).
 * - Payroll (SALA): 510506 Sueldos against 2370 Retenciones y aportes de
 *   nómina (deductions) and 111005 Bancos (net paid).
 */
export const DEFAULT_POSTING_RULES: readonly DefaultPostingRule[] = [
  { key: 'payment.debit.default', accountCode: CASH },
  { key: 'payment.debit.method.efectivo', accountCode: CASH },
  ...ELECTRONIC_METHODS.map((method) => ({ key: `payment.debit.method.${method}`, accountCode: BANK })),
  { key: 'payment.credit.default', accountCode: '413502' },
  { key: 'payment.credit.category.matricula', accountCode: '413501' },
  { key: 'payment.credit.category.inscripcion', accountCode: '413501' },
  { key: 'payment.credit.category.pension', accountCode: '413502' },
  { key: 'payment.credit.category.mensualidad', accountCode: '413502' },
  { key: 'payment.credit.category.transporte', accountCode: '413510' },
  { key: 'payment.credit.category.certificado', accountCode: '413503' },
  { key: 'payment.credit.category.recargo', accountCode: '4210' },
  { key: 'payment.credit.unapplied', accountCode: '2805' },
  { key: 'expense.debit.default', accountCode: '5195' },
  { key: 'expense.credit.default', accountCode: CASH },
  { key: 'payroll.debit.gross', accountCode: '510506' },
  { key: 'payroll.credit.deductions', accountCode: '2370' },
  { key: 'payroll.credit.net', accountCode: BANK },
];
