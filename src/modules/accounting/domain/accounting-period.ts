import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { CalendarDay } from './calendar-day.js';

export type PeriodStatus = 'open' | 'closed';

export interface AccountingPeriodProps {
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt: Date | null;
  closedBy: number | null;
  reopenedAt: Date | null;
  reopenedBy: number | null;
  reopenReason: string | null;
  createdAt: Date | null;
}

/**
 * Accounting period (`accounting_periods`, legacy `accounting/periods.php`).
 *
 * - RN-PER-01: name, start and end are mandatory and `start <= end` (the
 *   no-overlap rule needs other periods and is checked by the use case).
 * - RN-PER-02: born `open`.
 * - RN-PER-03: a closed period blocks posting and voiding its entries.
 * - RN-PER-04: closing/reopening are explicit transitions (the legacy toggle
 *   trusted the status sent by the browser) and reopening requires a reason
 *   that is audited.
 */
export class AccountingPeriod extends Entity<AccountingPeriodProps> {
  private constructor(id: EntityId, props: AccountingPeriodProps) {
    super(id, props);
  }

  static create(input: { name: string; startDate: string; endDate: string }): AccountingPeriod {
    const name = input.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 100, 'nombre');
    const startDate = CalendarDay.parse(input.startDate, 'fecha inicial');
    const endDate = CalendarDay.parse(input.endDate, 'fecha final');
    CalendarDay.assertRange(startDate, endDate);
    return new AccountingPeriod(null, {
      name,
      startDate,
      endDate,
      status: 'open',
      closedAt: null,
      closedBy: null,
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
      createdAt: null,
    });
  }

  static restore(id: number, props: AccountingPeriodProps): AccountingPeriod {
    return new AccountingPeriod(id, { ...props });
  }

  get name(): string {
    return this.props.name;
  }
  get startDate(): string {
    return this.props.startDate;
  }
  get endDate(): string {
    return this.props.endDate;
  }
  get status(): PeriodStatus {
    return this.props.status;
  }
  get isOpen(): boolean {
    return this.props.status === 'open';
  }
  get closedAt(): Date | null {
    return this.props.closedAt;
  }
  get closedBy(): number | null {
    return this.props.closedBy;
  }
  get reopenedAt(): Date | null {
    return this.props.reopenedAt;
  }
  get reopenedBy(): number | null {
    return this.props.reopenedBy;
  }
  get reopenReason(): string | null {
    return this.props.reopenReason;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  contains(day: string): boolean {
    return day >= this.props.startDate && day <= this.props.endDate;
  }

  overlaps(startDate: string, endDate: string): boolean {
    return startDate <= this.props.endDate && endDate >= this.props.startDate;
  }

  close(by: number, at: Date): void {
    if (!this.isOpen) {
      throw new BusinessRuleViolationError('El periodo ya está cerrado.', 'PERIOD_ALREADY_CLOSED');
    }
    this.props.status = 'closed';
    this.props.closedAt = at;
    this.props.closedBy = by;
  }

  reopen(by: number, at: Date, reason: string): void {
    if (this.isOpen) {
      throw new BusinessRuleViolationError('El periodo ya está abierto.', 'PERIOD_ALREADY_OPEN');
    }
    const trimmed = reason?.trim();
    Guard.againstEmpty(trimmed, 'motivo de reapertura');
    Guard.againstMaxLength(trimmed, 255, 'motivo de reapertura');
    this.props.status = 'open';
    this.props.reopenedAt = at;
    this.props.reopenedBy = by;
    this.props.reopenReason = trimmed;
  }

  /** RN-PER-03: fails unless the period is open. */
  assertOpen(): void {
    if (!this.isOpen) {
      throw new BusinessRuleViolationError(
        `El periodo "${this.props.name}" está cerrado. No se pueden registrar ni anular asientos en él.`,
        'PERIOD_CLOSED',
      );
    }
  }
}
