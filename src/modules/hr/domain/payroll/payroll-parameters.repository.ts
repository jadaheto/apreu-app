import type { PayrollParameters } from './payroll-parameters.js';

/** Output port for the yearly {@link PayrollParameters}. */
export interface PayrollParametersRepository {
  findByYear(year: number): Promise<PayrollParameters | null>;
  /** Inserts or replaces the parameters of `params.year`. */
  save(params: PayrollParameters, updatedBy: number): Promise<void>;
}

export const PAYROLL_PARAMETERS_REPOSITORY = Symbol('PayrollParametersRepository');
