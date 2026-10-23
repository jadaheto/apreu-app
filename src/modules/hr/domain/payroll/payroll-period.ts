import { BusinessRuleViolationError, ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { CalendarDate, type IsoDate } from '../common/calendar-date.js';
import { PAY_FREQUENCIES, type PayFrequency } from './pay-frequency.js';

export const PAYROLL_PERIOD_STATUSES = ['draft', 'calculated', 'approved', 'paid', 'cancelled'] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

export interface PayrollTotals {
  gross: Money;
  deductions: Money;
  net: Money;
}

export interface PayrollPeriodProps {
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  paymentDate: IsoDate;
  frequency: PayFrequency;
  status: PayrollPeriodStatus;
  totals: PayrollTotals;
  periodLabel: string;
  year: number;
  createdBy: number | null;
  calculatedBy: number | null;
  calculatedAt: Date | null;
  approvedBy: number | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date | null;
}

export interface NewPayrollPeriod {
  name?: string | null;
  startDate: string;
  endDate: string;
  paymentDate: string;
  frequency: PayFrequency;
  createdBy: number;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Payroll period (`payroll_periods`). State machine (analysis 07 §4.5):
 *
 * DRAFT ─calculate─► CALCULATED ─approve─► APPROVED ─pay─► PAID
 *   ▲  └─cancel─► CANCELLED   │ └─cancel─► CANCELLED
 *   └──── novelty changed ────┘
 *
 * Only DRAFT/CALCULATED accept novelties and recalculation; APPROVED freezes
 * the payslips; PAID is terminal. Dates must describe exactly one calendar
 * month or fortnight (fixes B-10 and B-14).
 */
export class PayrollPeriod extends Entity<PayrollPeriodProps> {
  private constructor(id: EntityId, props: PayrollPeriodProps) {
    super(id, props);
  }

  static create(input: NewPayrollPeriod): PayrollPeriod {
    Guard.oneOf(input.frequency, PAY_FREQUENCIES, 'frecuencia');
    const startDate = CalendarDate.assert(input.startDate, 'fecha inicial');
    const endDate = CalendarDate.assert(input.endDate, 'fecha final');
    const paymentDate = CalendarDate.assert(input.paymentDate, 'fecha de pago');
    const periodLabel = PayrollPeriod.labelFor(startDate, endDate, input.frequency);
    if (paymentDate < startDate) {
      throw new BusinessRuleViolationError(
        'La fecha de pago no puede ser anterior al inicio del período.',
        'INVALID_PAYMENT_DATE',
      );
    }
    const name = input.name?.trim() || `Nómina ${periodLabel}`;
    Guard.againstMaxLength(name, 100, 'nombre');
    return new PayrollPeriod(null, {
      name,
      startDate,
      endDate,
      paymentDate,
      frequency: input.frequency,
      status: 'draft',
      totals: { gross: Money.zero(), deductions: Money.zero(), net: Money.zero() },
      periodLabel,
      year: CalendarDate.parts(startDate).year,
      createdBy: input.createdBy,
      calculatedBy: null,
      calculatedAt: null,
      approvedBy: null,
      approvedAt: null,
      paidAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: null,
    });
  }

  static restore(id: number, props: PayrollPeriodProps): PayrollPeriod {
    return new PayrollPeriod(id, { ...props });
  }

  /**
   * Validates the shape of the period and returns its label, e.g.
   * "marzo 2026" or "1ª quincena de marzo 2026".
   */
  static labelFor(start: IsoDate, end: IsoDate, frequency: PayFrequency): string {
    const a = CalendarDate.parts(start);
    const b = CalendarDate.parts(end);
    const month = `${MONTHS[a.month - 1]} ${a.year}`;
    const sameMonth = a.year === b.year && a.month === b.month;
    const lastDay = CalendarDate.daysInMonth(a.year, a.month);
    if (frequency === 'monthly' && sameMonth && a.day === 1 && b.day === lastDay) return month;
    if (frequency === 'biweekly' && sameMonth && a.day === 1 && b.day === 15) return `1ª quincena de ${month}`;
    if (frequency === 'biweekly' && sameMonth && a.day === 16 && b.day === lastDay) return `2ª quincena de ${month}`;
    throw new BusinessRuleViolationError(
      frequency === 'monthly'
        ? 'Un período mensual debe ir del primer al último día del mismo mes.'
        : 'Un período quincenal debe ir del 1 al 15 o del 16 al último día del mes.',
      'INVALID_PERIOD_RANGE',
    );
  }

  get name(): string {
    return this.props.name;
  }
  get startDate(): IsoDate {
    return this.props.startDate;
  }
  get endDate(): IsoDate {
    return this.props.endDate;
  }
  get paymentDate(): IsoDate {
    return this.props.paymentDate;
  }
  get frequency(): PayFrequency {
    return this.props.frequency;
  }
  get status(): PayrollPeriodStatus {
    return this.props.status;
  }
  get totals(): PayrollTotals {
    return { ...this.props.totals };
  }
  get periodLabel(): string {
    return this.props.periodLabel;
  }
  get year(): number {
    return this.props.year;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get calculatedBy(): number | null {
    return this.props.calculatedBy;
  }
  get calculatedAt(): Date | null {
    return this.props.calculatedAt;
  }
  get approvedBy(): number | null {
    return this.props.approvedBy;
  }
  get approvedAt(): Date | null {
    return this.props.approvedAt;
  }
  get paidAt(): Date | null {
    return this.props.paidAt;
  }
  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }
  get cancellationReason(): string | null {
    return this.props.cancellationReason;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Payslips are visible to employees once the period is approved. */
  get isReleased(): boolean {
    return this.props.status === 'approved' || this.props.status === 'paid';
  }

  overlaps(start: IsoDate, end: IsoDate): boolean {
    return CalendarDate.rangesOverlap(this.props.startDate, this.props.endDate, start, end);
  }

  /** Fails unless novelties and recalculation are still allowed. */
  ensureEditable(): void {
    if (this.props.status !== 'draft' && this.props.status !== 'calculated') {
      throw new BusinessRuleViolationError(
        'El período ya fue aprobado o cerrado y no admite cambios.',
        'PAYROLL_PERIOD_LOCKED',
        { status: this.props.status },
      );
    }
  }

  /** A novelty changed after calculating: the period must be recalculated before approval. */
  invalidateCalculation(): void {
    this.ensureEditable();
    this.props.status = 'draft';
  }

  recordCalculation(totals: PayrollTotals, by: number, at: Date): void {
    this.ensureEditable();
    this.props.totals = { ...totals };
    this.props.status = 'calculated';
    this.props.calculatedBy = by;
    this.props.calculatedAt = at;
  }

  /**
   * Freezes the payslips. With `enforceSegregation` (HR users) the approver
   * must be a different person than whoever calculated the period.
   */
  approve(by: number, at: Date, enforceSegregation: boolean): void {
    this.ensureStatus('calculated', 'aprobar');
    if (enforceSegregation && this.props.calculatedBy === by) {
      throw new ForbiddenError('Quien liquida la nómina no puede aprobarla; solicite la aprobación a otra persona.');
    }
    this.props.status = 'approved';
    this.props.approvedBy = by;
    this.props.approvedAt = at;
  }

  markPaid(at: Date): void {
    this.ensureStatus('approved', 'registrar el pago de');
    this.props.status = 'paid';
    this.props.paidAt = at;
  }

  cancel(reason: string, at: Date): void {
    this.ensureEditable();
    const trimmed = reason?.trim();
    Guard.againstEmpty(trimmed, 'motivo de anulación');
    Guard.againstMaxLength(trimmed, 255, 'motivo de anulación');
    this.props.status = 'cancelled';
    this.props.cancelledAt = at;
    this.props.cancellationReason = trimmed;
  }

  private ensureStatus(expected: PayrollPeriodStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new BusinessRuleViolationError(
        `No se puede ${action} un período en estado "${this.props.status}".`,
        'INVALID_PAYROLL_PERIOD_STATUS',
        { status: this.props.status, expected },
      );
    }
  }
}
