/** Collection risk of a debtor by the age of their oldest overdue charge. */
export type DebtRisk = 'low' | 'medium' | 'high' | 'critical';

/**
 * Traffic light of the overdue portfolio (legacy `admin/index.php`):
 * more than 90 days → critical, more than 60 → high, more than 30 → medium,
 * otherwise low.
 */
export const classifyDebtRisk = (daysOverdue: number): DebtRisk => {
  if (daysOverdue > 90) return 'critical';
  if (daysOverdue > 60) return 'high';
  if (daysOverdue > 30) return 'medium';
  return 'low';
};
