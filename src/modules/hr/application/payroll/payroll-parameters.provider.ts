import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { PayrollParameters } from '../../domain/payroll/payroll-parameters.js';
import {
  PAYROLL_PARAMETERS_REPOSITORY,
  type PayrollParametersRepository,
} from '../../domain/payroll/payroll-parameters.repository.js';

export type PayrollParametersSource = 'configured' | 'legal-default';

/**
 * Resolves the legal parameters of a year: the values configured by the
 * school or, when missing, the built-in legal values (2025, 2026). Fails
 * loudly instead of calculating with zeros (legacy B-13).
 */
@Injectable()
export class PayrollParametersProvider {
  constructor(@Inject(PAYROLL_PARAMETERS_REPOSITORY) private readonly repository: PayrollParametersRepository) {}

  async find(year: number): Promise<{ params: PayrollParameters; source: PayrollParametersSource } | null> {
    const configured = await this.repository.findByYear(year);
    if (configured) return { params: configured, source: 'configured' };
    const legal = PayrollParameters.legalDefault(year);
    return legal ? { params: legal, source: 'legal-default' } : null;
  }

  async forYear(year: number): Promise<PayrollParameters> {
    const found = await this.find(year);
    if (!found) {
      throw new BusinessRuleViolationError(
        `No hay parámetros de nómina (SMMLV, auxilio, UVT) configurados para ${year}.`,
        'PAYROLL_PARAMETERS_MISSING',
        { year },
      );
    }
    return found.params;
  }
}
