import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { Calendar } from './calendar.js';
import { RISK_LEVELS, riskLevelFromDays, type RiskLevel } from './risk-level.js';

/** One overdue charge with balance, as read for the aging report. */
export interface OverdueCharge {
  studentId: number;
  studentName: string;
  studentCode: string;
  gradeId: number | null;
  gradeName: string | null;
  classroomName: string | null;
  dueDate: string;
  pending: Money;
}

/** A student with overdue balance. */
export interface Debtor {
  studentId: number;
  studentName: string;
  studentCode: string;
  gradeId: number | null;
  gradeName: string | null;
  classroomName: string | null;
  oldestDueDate: string;
  daysOverdue: number;
  risk: RiskLevel;
  chargesCount: number;
  balance: Money;
}

export interface RiskBucket {
  debtors: number;
  balance: Money;
}

export interface AgingSummary {
  total: RiskBucket;
  byRisk: Record<RiskLevel, RiskBucket>;
}

/**
 * Portfolio aging (legacy `finance/collection.php`, rules RN-19..RN-21):
 * groups overdue charges per student, ages the debtor by its oldest overdue
 * due date and classifies the risk. Sorted by days overdue, then balance.
 */
export const AgingCalculator = {
  debtors(charges: OverdueCharge[], today: string): Debtor[] {
    const byStudent = new Map<number, Debtor>();
    for (const charge of charges) {
      if (!charge.pending.isGreaterThan(Money.zero()) || charge.dueDate >= today) continue;
      const current = byStudent.get(charge.studentId);
      if (!current) {
        byStudent.set(charge.studentId, {
          ...charge,
          oldestDueDate: charge.dueDate,
          daysOverdue: 0,
          risk: 'bajo',
          chargesCount: 1,
          balance: charge.pending,
        });
        continue;
      }
      current.chargesCount++;
      current.balance = current.balance.add(charge.pending);
      if (charge.dueDate < current.oldestDueDate) current.oldestDueDate = charge.dueDate;
    }
    return [...byStudent.values()]
      .map((debtor) => {
        const daysOverdue = Calendar.daysBetween(debtor.oldestDueDate, today);
        return { ...debtor, daysOverdue, risk: riskLevelFromDays(daysOverdue) };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance.cents - a.balance.cents);
  },

  summarize(debtors: Debtor[]): AgingSummary {
    const empty = (): RiskBucket => ({ debtors: 0, balance: Money.zero() });
    const byRisk = Object.fromEntries(RISK_LEVELS.map((risk) => [risk, empty()])) as Record<RiskLevel, RiskBucket>;
    const total = empty();
    for (const debtor of debtors) {
      for (const bucket of [byRisk[debtor.risk], total]) {
        bucket.debtors++;
        bucket.balance = bucket.balance.add(debtor.balance);
      }
    }
    return { total, byRisk };
  },
};
