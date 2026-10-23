import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import type { PayrollPeriod } from '../../domain/payroll/payroll-period.js';
import type { PayrollPeriodRepository } from '../../domain/payroll/payroll.repositories.js';

/** Loads a period that must exist; editability is checked by the aggregate. */
export const loadPeriod = async (periods: PayrollPeriodRepository, periodId: number): Promise<PayrollPeriod> => {
  const period = await periods.findById(periodId);
  if (!period) throw new NotFoundError('Período de nómina', periodId);
  return period;
};
