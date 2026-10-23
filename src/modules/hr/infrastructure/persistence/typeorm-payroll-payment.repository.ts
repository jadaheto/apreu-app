import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import { toOffset, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { PAYROLL_PAYMENT_STATUSES, type PayrollPayment } from '../../domain/payroll/payroll-payment.js';
import type {
  AnnualPayrollTotals,
  PayrollMonthKpis,
  PayrollPaymentRepository,
  PayslipSummary,
} from '../../domain/payroll/payroll.repositories.js';
import { enumValue } from './enum-value.js';
import { PayrollPaymentMapper } from './payroll.mappers.js';
import { PayrollPaymentOrmEntity } from './payroll-payment.orm-entity.js';
import { PayrollPeriodOrmEntity } from './payroll-period.orm-entity.js';

interface PayslipRow {
  paymentId: number;
  periodId: number;
  periodName: string;
  periodLabel: string | null;
  startDate: string;
  endDate: string;
  paymentDate: string | null;
  gross: string;
  deductions: string;
  net: string;
  status: string;
}

const money = (value: string | number | null) => Money.of(Number(value ?? 0));

/** TypeORM adapter of {@link PayrollPaymentRepository}. */
@Injectable()
export class TypeOrmPayrollPaymentRepository implements PayrollPaymentRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<PayrollPayment | null> {
    const row = await (await this.db.repository(PayrollPaymentOrmEntity)).findOneBy({ id });
    return row ? PayrollPaymentMapper.toDomain(row) : null;
  }

  async findByPeriod(periodId: number): Promise<PayrollPayment[]> {
    const rows = await (
      await this.db.repository(PayrollPaymentOrmEntity)
    ).find({
      where: { payrollPeriodId: periodId },
      order: { id: 'ASC' },
    });
    return rows.map(PayrollPaymentMapper.toDomain);
  }

  async replaceForPeriod(periodId: number, payments: PayrollPayment[]): Promise<void> {
    const repository = await this.db.repository(PayrollPaymentOrmEntity);
    await repository.delete({ payrollPeriodId: periodId });
    for (const payment of payments) {
      const saved = await repository.save(PayrollPaymentMapper.toPersistence(payment));
      if (payment.isNew) payment.assignId(saved.id);
    }
  }

  async saveAll(payments: PayrollPayment[]): Promise<void> {
    if (payments.length === 0) return;
    await (await this.db.repository(PayrollPaymentOrmEntity)).save(payments.map(PayrollPaymentMapper.toPersistence));
  }

  async listForEmployee(
    employeeId: number,
    onlyReleased: boolean,
    page: PageRequest,
  ): Promise<Paginated<PayslipSummary>> {
    const query = (await this.joinedWithPeriod())
      .where('pp.employee_id = :employeeId', { employeeId })
      .select([
        'pp.id AS "paymentId"',
        'per.id AS "periodId"',
        'per.name AS "periodName"',
        'per.period_label AS "periodLabel"',
        `to_char(per.period_start, 'YYYY-MM-DD') AS "startDate"`,
        `to_char(per.period_end, 'YYYY-MM-DD') AS "endDate"`,
        `to_char(per.payment_date, 'YYYY-MM-DD') AS "paymentDate"`,
        'pp.gross_salary AS gross',
        'pp.total_deductions AS deductions',
        'pp.net_salary AS net',
        'pp.status AS status',
      ]);
    if (onlyReleased) {
      query.andWhere("per.status IN ('approved', 'paid')").andWhere("pp.status <> 'cancelled'");
    }
    const total = await query.getCount();
    const rows: PayslipRow[] = await query
      .orderBy('per.period_start', 'DESC')
      .offset(toOffset(page))
      .limit(page.limit)
      .getRawMany();
    return {
      items: rows.map((r) => ({
        paymentId: Number(r.paymentId),
        periodId: Number(r.periodId),
        periodName: r.periodName,
        periodLabel: r.periodLabel ?? r.periodName,
        startDate: r.startDate,
        endDate: r.endDate,
        paymentDate: r.paymentDate,
        gross: money(r.gross),
        totalDeductions: money(r.deductions),
        net: money(r.net),
        status: enumValue(r.status, PAYROLL_PAYMENT_STATUSES, 'pending'),
      })),
      total,
      page: page.page,
      limit: page.limit,
    };
  }

  async monthKpis(year: number, month: number): Promise<PayrollMonthKpis> {
    const row = await (
      await this.joinedWithPeriod()
    )
      .select('COUNT(pp.id)::int', 'employees')
      .addSelect('COALESCE(SUM(pp.gross_salary), 0)', 'gross')
      .addSelect('COALESCE(SUM(pp.total_deductions), 0)', 'deductions')
      .addSelect('COALESCE(SUM(pp.net_salary), 0)', 'net')
      .where("per.status <> 'cancelled'")
      .andWhere('EXTRACT(YEAR FROM per.period_start) = :year AND EXTRACT(MONTH FROM per.period_start) = :month', {
        year,
        month,
      })
      .getRawOne();
    return {
      employees: Number(row?.employees ?? 0),
      gross: money(row?.gross),
      deductions: money(row?.deductions),
      net: money(row?.net),
    };
  }

  async annualTotals(employeeId: number, year: number): Promise<AnnualPayrollTotals> {
    const row = await (
      await this.joinedWithPeriod()
    )
      .select('COUNT(pp.id)::int', 'payments')
      .addSelect('COALESCE(SUM(pp.gross_salary), 0)', 'gross')
      .addSelect('COALESCE(SUM(pp.health_deduction), 0)', 'health')
      .addSelect('COALESCE(SUM(pp.pension_deduction), 0)', 'pension')
      .addSelect('COALESCE(SUM(pp.solidarity_fund_deduction), 0)', 'solidarityFund')
      .addSelect('COALESCE(SUM(GREATEST(pp.retefuente, pp.income_tax)), 0)', 'withholding')
      .addSelect('COALESCE(SUM(pp.net_salary), 0)', 'net')
      .where('pp.employee_id = :employeeId', { employeeId })
      .andWhere("pp.status = 'paid'")
      .andWhere('per.year = :year', { year })
      .getRawOne();
    return {
      payments: Number(row?.payments ?? 0),
      gross: money(row?.gross),
      health: money(row?.health),
      pension: money(row?.pension),
      solidarityFund: money(row?.solidarityFund),
      withholding: money(row?.withholding),
      net: money(row?.net),
    };
  }

  private async joinedWithPeriod(): Promise<SelectQueryBuilder<PayrollPaymentOrmEntity>> {
    return (await this.db.repository(PayrollPaymentOrmEntity))
      .createQueryBuilder('pp')
      .innerJoin(PayrollPeriodOrmEntity, 'per', 'per.id = pp.payroll_period_id');
  }
}
