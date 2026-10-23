/** Collection risk of a debtor by age of the oldest overdue charge (legacy `finance/collection.php`). */
export const RISK_LEVELS = ['critico', 'alto', 'medio', 'bajo'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Rule RN-20: Bajo ≤ 30, Medio 31–60, Alto 61–90, Crítico > 90 days. */
export const riskLevelFromDays = (daysOverdue: number): RiskLevel => {
  if (daysOverdue > 90) return 'critico';
  if (daysOverdue > 60) return 'alto';
  if (daysOverdue > 30) return 'medio';
  return 'bajo';
};
