import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ChargeTaxPort } from '../../domain/charge-tax.port.js';

/** Read-only query of the VAT rate of student charges (finance context tables). */
@Injectable()
export class SqlChargeTax implements ChargeTaxPort {
  constructor(private readonly db: TenantDataSource) {}

  async taxRatesOf(studentChargeIds: number[]): Promise<Map<number, number>> {
    if (studentChargeIds.length === 0) return new Map();
    const rows: { id: number; rate: string | null }[] = await (
      await this.db.manager()
    ).query(
      `SELECT sc.id, COALESCE(NULLIF(sc.tax_rate, 0), bc.tax_rate, 0) AS rate
         FROM student_charges sc LEFT JOIN billing_concepts bc ON bc.id = sc.concept_id
        WHERE sc.id = ANY($1::int[])`,
      [studentChargeIds],
    );
    return new Map(rows.map((row) => [Number(row.id), Number(row.rate ?? 0)]));
  }
}
