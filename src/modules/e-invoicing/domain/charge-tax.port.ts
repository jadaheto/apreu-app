/**
 * Read-only access to the VAT rate of student charges (finance context:
 * `student_charges.tax_rate`, falling back to `billing_concepts.tax_rate`).
 * A rate of 0 means the concept is excluded from VAT (educational services).
 */
export interface ChargeTaxPort {
  /** Percentage per student charge id; unknown ids are omitted. */
  taxRatesOf(studentChargeIds: number[]): Promise<Map<number, number>>;
}

export const CHARGE_TAX = Symbol('ChargeTaxPort');
