import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { toOffset, type PageRequest, type Paginated } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { IsoDate } from '../domain/common/calendar-date.js';
import type { PayrollParameters } from '../domain/payroll/payroll-parameters.js';
import type { PayrollParametersRepository } from '../domain/payroll/payroll-parameters.repository.js';
import type { PayrollNovelty } from '../domain/payroll/payroll-novelty.js';
import type { PayrollPayment } from '../domain/payroll/payroll-payment.js';
import type { PayrollPeriod } from '../domain/payroll/payroll-period.js';
import type {
  AnnualPayrollTotals,
  PayrollMonthKpis,
  PayrollNoveltyRepository,
  PayrollPaymentRepository,
  PayrollPeriodCriteria,
  PayrollPeriodRepository,
  PayslipSummary,
} from '../domain/payroll/payroll.repositories.js';

export class InMemoryPayrollPeriodRepository implements PayrollPeriodRepository {
  readonly store = new InMemoryStore<PayrollPeriod>();

  async findById(id: number) {
    return this.store.get(id);
  }

  async findByIds(ids: number[]) {
    return this.store.all().filter((p) => ids.includes(p.id as number));
  }

  async search(criteria: PayrollPeriodCriteria, page: PageRequest): Promise<Paginated<PayrollPeriod>> {
    const matches = this.store
      .all()
      .filter((p) => !criteria.year || p.year === criteria.year)
      .filter((p) => !criteria.status || p.status === criteria.status)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }

  async findOverlapping(start: IsoDate, end: IsoDate, excludeId?: number) {
    return this.store.all().filter((p) => p.id !== excludeId && p.status !== 'cancelled' && p.overlaps(start, end));
  }

  async existsPaidInYear(year: number) {
    return this.store.all().some((p) => p.year === year && p.status === 'paid');
  }

  async save(period: PayrollPeriod) {
    this.store.save(period);
  }
}

export class InMemoryPayrollPaymentRepository implements PayrollPaymentRepository {
  readonly store = new InMemoryStore<PayrollPayment>();

  constructor(private readonly periods: InMemoryPayrollPeriodRepository) {}

  async findById(id: number) {
    return this.store.get(id);
  }

  async findByPeriod(periodId: number) {
    return this.store.all().filter((p) => p.periodId === periodId);
  }

  async replaceForPeriod(periodId: number, payments: PayrollPayment[]) {
    for (const old of await this.findByPeriod(periodId)) this.store.items.delete(old.id as number);
    payments.forEach((p) => this.store.save(p));
  }

  async saveAll(payments: PayrollPayment[]) {
    payments.forEach((p) => this.store.save(p));
  }

  async listForEmployee(
    employeeId: number,
    onlyReleased: boolean,
    page: PageRequest,
  ): Promise<Paginated<PayslipSummary>> {
    const rows = this.store
      .all()
      .filter((p) => p.employeeId === employeeId)
      .map((payment) => ({ payment, period: this.periods.store.get(payment.periodId) as PayrollPeriod }))
      .filter(({ payment, period }) => !onlyReleased || (period.isReleased && payment.status !== 'cancelled'))
      .sort((a, b) => b.period.startDate.localeCompare(a.period.startDate))
      .map(({ payment, period }) => ({
        paymentId: payment.id as number,
        periodId: period.id as number,
        periodName: period.name,
        periodLabel: period.periodLabel,
        startDate: period.startDate,
        endDate: period.endDate,
        paymentDate: period.paymentDate,
        gross: payment.gross,
        totalDeductions: payment.totalDeductions,
        net: payment.net,
        status: payment.status,
      }));
    const offset = toOffset(page);
    return { items: rows.slice(offset, offset + page.limit), total: rows.length, ...page };
  }

  async monthKpis(year: number, month: number): Promise<PayrollMonthKpis> {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const payments = this.store.all().filter((p) => {
      const period = this.periods.store.get(p.periodId);
      return period && period.status !== 'cancelled' && period.startDate.startsWith(prefix);
    });
    const sum = (pick: (p: PayrollPayment) => Money) => payments.reduce((a, p) => a.add(pick(p)), Money.zero());
    return {
      employees: payments.length,
      gross: sum((p) => p.gross),
      deductions: sum((p) => p.totalDeductions),
      net: sum((p) => p.net),
    };
  }

  async annualTotals(employeeId: number, year: number): Promise<AnnualPayrollTotals> {
    const payments = this.store
      .all()
      .filter(
        (p) => p.employeeId === employeeId && p.status === 'paid' && this.periods.store.get(p.periodId)?.year === year,
      );
    const sum = (pick: (p: PayrollPayment) => Money) => payments.reduce((a, p) => a.add(pick(p)), Money.zero());
    return {
      payments: payments.length,
      gross: sum((p) => p.gross),
      health: sum((p) => p.health),
      pension: sum((p) => p.pension),
      solidarityFund: sum((p) => p.solidarityFund),
      withholding: sum((p) => p.withholding),
      net: sum((p) => p.net),
    };
  }
}

export class InMemoryPayrollNoveltyRepository implements PayrollNoveltyRepository {
  readonly store = new InMemoryStore<PayrollNovelty>();

  async findById(id: number) {
    return this.store.get(id);
  }

  async findByPeriod(periodId: number) {
    return this.store.all().filter((n) => n.periodId === periodId);
  }

  async save(novelty: PayrollNovelty) {
    this.store.save(novelty);
  }

  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryPayrollParametersRepository implements PayrollParametersRepository {
  readonly byYear = new Map<number, PayrollParameters>();

  async findByYear(year: number) {
    return this.byYear.get(year) ?? null;
  }

  async save(params: PayrollParameters) {
    this.byYear.set(params.year, params);
  }
}
