import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { CHARGE_QUERIES, type ChargeQueriesPort, type ChargeSummaryRow } from './ports/charge-queries.port.js';

export interface ChargeSummaryView extends ChargeSummaryRow {
  /** % of charges fully paid (legacy "% Recaudo", by count). */
  paidRate: number;
  /** % of the billed money already collected. */
  collectedRate: number;
}

const percent = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Generated charges grouped by concept and month, most recent first (legacy "Cargos generados"). */
@Injectable()
export class GetChargesSummaryUseCase implements UseCase<{ limit: number }, ChargeSummaryView[]> {
  constructor(@Inject(CHARGE_QUERIES) private readonly queries: ChargeQueriesPort) {}

  async execute({ limit }: { limit: number }): Promise<ChargeSummaryView[]> {
    return (await this.queries.summary(limit)).map((row) => ({
      ...row,
      paidRate: percent(row.paidCount, row.chargesCount),
      collectedRate: percent(row.totalPaid, row.totalNet),
    }));
  }
}
