import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

/** Accounting classes stored in `accounting_accounts.type`. */
export const ACCOUNT_TYPES = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo', 'orden'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Natural side of an account: where its balance increases. */
export type AccountNature = 'debito' | 'credito';

const TYPE_BY_FIRST_DIGIT: Record<string, AccountType> = {
  '1': 'activo',
  '2': 'pasivo',
  '3': 'patrimonio',
  '4': 'ingreso',
  '5': 'gasto',
  '6': 'costo',
  '7': 'costo',
  '8': 'orden',
  '9': 'orden',
};

/**
 * Accounting class implied by the first digit of a PUC code (RN-ACC-03,
 * Decreto 2650/93): 1 activo, 2 pasivo, 3 patrimonio, 4 ingreso, 5 gasto,
 * 6/7 costo, 8/9 orden.
 */
export const typeForCode = (code: string): AccountType => {
  const type = TYPE_BY_FIRST_DIGIT[code.charAt(0)];
  if (!type) {
    throw new BusinessRuleViolationError(
      `El código "${code}" no corresponde a una clase del PUC.`,
      'INVALID_ACCOUNT_CODE',
    );
  }
  return type;
};

/**
 * Nature of an account (RN-ACC-04): débito for activo, gasto, costo and
 * deudoras de orden (8); crédito for pasivo, patrimonio, ingreso and
 * acreedoras de orden (9).
 */
export const natureOf = (type: AccountType, code: string): AccountNature => {
  if (type === 'orden') return code.startsWith('9') ? 'credito' : 'debito';
  return type === 'activo' || type === 'gasto' || type === 'costo' ? 'debito' : 'credito';
};

/** Balance in cents according to the nature: débito → D−C, crédito → C−D. */
export const naturalBalance = (nature: AccountNature, debitCents: number, creditCents: number): number =>
  nature === 'debito' ? debitCents - creditCents : creditCents - debitCents;
