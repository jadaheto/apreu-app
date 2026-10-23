import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

/**
 * Configurable account mapping used to generate automatic journal entries
 * from integration events (`accounting_posting_rules`). Each rule maps a key
 * to a transactional account; lookups try specific keys first and then the
 * `default` key (e.g. `payment.debit.method.nequi` → `payment.debit.default`).
 */
export interface PostingRule {
  key: string;
  accountId: number;
}

interface RuleKeyDefinition {
  pattern: RegExp;
  description: string;
  example: string;
}

/** Catalogue of supported rule keys (documentation for the parametrization screen). */
export const POSTING_RULE_KEY_DEFINITIONS: readonly RuleKeyDefinition[] = [
  {
    pattern: /^payment\.debit\.default$/,
    example: 'payment.debit.default',
    description: 'Pagos: cuenta débito (caja/bancos) por defecto',
  },
  {
    pattern: /^payment\.debit\.method\.[a-z_]+$/,
    example: 'payment.debit.method.transferencia',
    description: 'Pagos: cuenta débito según método de pago',
  },
  {
    pattern: /^payment\.credit\.default$/,
    example: 'payment.credit.default',
    description: 'Pagos: cuenta crédito (ingreso/cartera) por defecto',
  },
  {
    pattern: /^payment\.credit\.concept\.\d+$/,
    example: 'payment.credit.concept.3',
    description: 'Pagos: cuenta crédito según concepto de cobro',
  },
  {
    pattern: /^payment\.credit\.category\.[a-z_]+$/,
    example: 'payment.credit.category.matricula',
    description: 'Pagos: cuenta crédito según categoría del concepto (matricula, pension, transporte…)',
  },
  {
    pattern: /^payment\.credit\.unapplied$/,
    example: 'payment.credit.unapplied',
    description: 'Pagos: excedente no aplicado a cargos (anticipos)',
  },
  {
    pattern: /^expense\.debit\.default$/,
    example: 'expense.debit.default',
    description: 'Gastos: cuenta débito (gasto) por defecto',
  },
  {
    pattern: /^expense\.debit\.category\.\d+$/,
    example: 'expense.debit.category.4',
    description: 'Gastos: cuenta débito según categoría de gasto',
  },
  {
    pattern: /^expense\.credit\.default$/,
    example: 'expense.credit.default',
    description: 'Gastos: cuenta crédito (caja/bancos/por pagar) por defecto',
  },
  {
    pattern: /^expense\.credit\.source\.[a-z0-9_-]+$/,
    example: 'expense.credit.source.manual',
    description: 'Gastos: cuenta crédito según origen del gasto',
  },
  {
    pattern: /^payroll\.debit\.gross$/,
    example: 'payroll.debit.gross',
    description: 'Nómina: gasto de personal (total devengado)',
  },
  {
    pattern: /^payroll\.credit\.deductions$/,
    example: 'payroll.credit.deductions',
    description: 'Nómina: deducciones por pagar (salud, pensión, otros)',
  },
  { pattern: /^payroll\.credit\.net$/, example: 'payroll.credit.net', description: 'Nómina: neto pagado (bancos)' },
];

const normalizeToken = (value: string | number): string =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');

/** Validates and normalizes a rule key. */
export const parsePostingRuleKey = (raw: string): string => {
  const key = (raw ?? '').trim().toLowerCase();
  if (!POSTING_RULE_KEY_DEFINITIONS.some(({ pattern }) => pattern.test(key))) {
    throw new BusinessRuleViolationError(
      `La clave de parametrización "${raw}" no es válida.`,
      'INVALID_POSTING_RULE_KEY',
      {
        supported: POSTING_RULE_KEY_DEFINITIONS.map(({ example }) => example),
      },
    );
  }
  return key;
};

/** Fallback chains (most specific first) used by the automatic posting use cases. */
export const PostingRuleKeys = {
  paymentDebit: (method: string) => [`payment.debit.method.${normalizeToken(method)}`, 'payment.debit.default'],
  paymentCredit: (conceptId: number, category?: string | null) => [
    `payment.credit.concept.${normalizeToken(conceptId)}`,
    ...(category ? [`payment.credit.category.${normalizeToken(category)}`] : []),
    'payment.credit.default',
  ],
  paymentUnapplied: () => ['payment.credit.unapplied', 'payment.credit.default'],
  expenseDebit: (categoryId: number | null) =>
    categoryId === null
      ? ['expense.debit.default']
      : [`expense.debit.category.${normalizeToken(categoryId)}`, 'expense.debit.default'],
  expenseCredit: (source: string) => [`expense.credit.source.${normalizeToken(source)}`, 'expense.credit.default'],
  payrollGross: () => ['payroll.debit.gross'],
  payrollDeductions: () => ['payroll.credit.deductions'],
  payrollNet: () => ['payroll.credit.net'],
};
