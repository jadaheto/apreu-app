import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { AgingCalculator, type OverdueCharge } from './aging.js';
import { riskLevelFromDays } from './risk-level.js';

const overdue = (studentId: number, dueDate: string, pending: number): OverdueCharge => ({
  studentId,
  studentName: `Alumno ${studentId}`,
  studentCode: `AL${studentId}`,
  gradeId: 1,
  gradeName: 'Primero',
  classroomName: '1A',
  dueDate,
  pending: Money.of(pending),
});

describe('riskLevelFromDays (RN-20)', () => {
  it.each([
    [0, 'bajo'],
    [30, 'bajo'],
    [31, 'medio'],
    [60, 'medio'],
    [61, 'alto'],
    [90, 'alto'],
    [91, 'critico'],
  ])('%i days → %s', (days, level) => {
    expect(riskLevelFromDays(days)).toBe(level);
  });
});

describe('AgingCalculator', () => {
  const today = '2026-06-01';

  it('groups per student, ages by the oldest due date and sorts', () => {
    const debtors = AgingCalculator.debtors(
      [
        overdue(1, '2026-05-15', 100),
        overdue(1, '2026-02-01', 50),
        overdue(2, '2026-05-20', 900),
        overdue(3, '2026-06-01', 999),
        overdue(4, '2026-05-01', 0),
      ],
      today,
    );
    expect(
      debtors.map((debtor) => [
        debtor.studentId,
        debtor.daysOverdue,
        debtor.risk,
        debtor.chargesCount,
        debtor.balance.amount,
      ]),
    ).toEqual([
      [1, 120, 'critico', 2, 150],
      [2, 12, 'bajo', 1, 900],
    ]);
  });

  it('summarizes per risk level and total', () => {
    const summary = AgingCalculator.summarize(
      AgingCalculator.debtors(
        [overdue(1, '2026-01-01', 10), overdue(2, '2026-05-25', 20), overdue(3, '2026-05-30', 5)],
        today,
      ),
    );
    expect(summary.total).toMatchObject({ debtors: 3 });
    expect(summary.total.balance.amount).toBe(35);
    expect(summary.byRisk.critico.debtors).toBe(1);
    expect(summary.byRisk.bajo.balance.amount).toBe(25);
    expect(summary.byRisk.alto.debtors).toBe(0);
  });
});
