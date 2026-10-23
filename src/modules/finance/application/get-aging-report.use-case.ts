import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { AgingCalculator, type RiskBucket } from '../domain/aging.js';
import { Calendar } from '../domain/calendar.js';
import { RISK_LEVELS, type RiskLevel } from '../domain/risk-level.js';
import { AGING_SOURCE, type AgingSourcePort } from './ports/aging-source.port.js';

export interface AgingReportInput {
  risk?: RiskLevel;
  gradeId?: number;
}

export interface DebtorView {
  position: number;
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
  balance: number;
}

export interface BucketView {
  debtors: number;
  balance: number;
}

export interface AgingReportView {
  today: string;
  total: BucketView;
  byRisk: Record<RiskLevel, BucketView>;
  debtors: DebtorView[];
}

const toBucket = (bucket: RiskBucket): BucketView => ({ debtors: bucket.debtors, balance: bucket.balance.amount });

/**
 * Portfolio control (legacy `finance/collection.php`, now restricted to staff,
 * bug S2). The grade filter applies in SQL (it did nothing in legacy, bug
 * B24) and also scopes the KPIs; the risk filter only narrows the list, so
 * the KPIs keep the breakdown by risk. Rows are numbered after filtering (bug B25).
 */
@Injectable()
export class GetAgingReportUseCase implements UseCase<AgingReportInput, AgingReportView> {
  constructor(
    @Inject(AGING_SOURCE) private readonly source: AgingSourcePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ risk, gradeId }: AgingReportInput): Promise<AgingReportView> {
    const today = Calendar.today(this.clock.now());
    const debtors = AgingCalculator.debtors(await this.source.overdueCharges({ today, gradeId }), today);
    const summary = AgingCalculator.summarize(debtors);
    const byRisk = Object.fromEntries(RISK_LEVELS.map((level) => [level, toBucket(summary.byRisk[level])])) as Record<
      RiskLevel,
      BucketView
    >;
    return {
      today,
      total: toBucket(summary.total),
      byRisk,
      debtors: debtors
        .filter((debtor) => !risk || debtor.risk === risk)
        .map((debtor, index) => ({ ...debtor, position: index + 1, balance: debtor.balance.amount })),
    };
  }
}
