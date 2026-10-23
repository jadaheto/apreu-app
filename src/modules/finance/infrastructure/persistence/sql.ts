import type { SqlParams } from '../../../../shared/infrastructure/persistence/sql.js';

export { likePattern, placeholders, toNumber as num } from '../../../../shared/infrastructure/persistence/sql.js';

/** Open statuses of a charge as SQL literal list. */
export const OPEN_STATUSES_SQL = `('pending', 'partial', 'overdue')`;

/**
 * Paid amount per charge counting only applied (non-reversed) payments
 * (rule RN-10). Join as `LEFT JOIN ${PAID_BY_CHARGE} pd ON pd.charge_id = sc.id`.
 */
export const PAID_BY_CHARGE = `(
  SELECT pa.charge_id, SUM(pa.amount_applied) AS paid
  FROM payment_applications pa
  INNER JOIN payments p ON p.id = pa.payment_id AND p.status = 'applied'
  GROUP BY pa.charge_id
)`;

/** Billed period of a charge (`billing_period`, or the due-date month for legacy rows). */
export const chargePeriodSql = (alias: string): string =>
  `COALESCE(${alias}.billing_period, to_char(${alias}.due_date, 'YYYY-MM'))`;

/** Index-friendly condition "charge billed in the period" (`YYYY-MM`, first day, last day). */
export const chargeInPeriodSql = (
  alias: string,
  params: SqlParams,
  period: { period: string; firstDay: string; lastDay: string },
): string =>
  `(${alias}.billing_period = ${params.add(period.period)} OR (${alias}.billing_period IS NULL AND ${alias}.due_date BETWEEN ${params.add(period.firstDay)} AND ${params.add(period.lastDay)}))`;
