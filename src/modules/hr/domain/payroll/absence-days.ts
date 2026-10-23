import { CalendarDate } from '../common/calendar-date.js';
import type { ContractWindow } from '../employees/employee.js';
import type { LeavePayTreatment } from '../leaves/leave-request.js';
import type { AbsenceDays } from './payroll-calculator.js';

/** An approved absence as seen by the payroll. */
export interface ApprovedAbsence {
  startDate: string;
  endDate: string;
  payTreatment: LeavePayTreatment;
}

/**
 * Converts approved leaves into commercial days of absence inside the
 * employee's contract window (analysis L-13, L-14). `worked` absences
 * (comisión de servicios) do not reduce worked days. The total never exceeds
 * the contract days even if legacy data contains overlapping leaves.
 */
export const AbsenceDaysCalculator = {
  forWindow(window: ContractWindow, contractDays: number, absences: readonly ApprovedAbsence[]): AbsenceDays {
    const result: AbsenceDays = { paid: 0, incapacity: 0, unpaid: 0 };
    let available = contractDays;
    for (const absence of absences) {
      if (absence.payTreatment === 'worked') continue;
      const from = CalendarDate.max(absence.startDate, window.from);
      const to = CalendarDate.min(absence.endDate, window.to);
      const days = Math.min(CalendarDate.commercialDaysInclusive(from, to), available);
      if (days <= 0) continue;
      result[absence.payTreatment] += days;
      available -= days;
    }
    return result;
  },
};
