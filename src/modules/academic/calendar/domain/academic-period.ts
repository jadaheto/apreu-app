import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { assertAcademicYear } from '../../common/domain/academic-year.js';
import { assertIsoDate, yearOfDate } from '../../common/domain/school-calendar.js';

export const PERIOD_STATUSES = ['open', 'closed', 'bulletins_generated'] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export interface AcademicPeriodProps {
  name: string;
  academicYear: number;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt: Date | null;
}

export interface PeriodSchedule {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Evaluation window of an academic year (`academic_periods`).
 * Legacy: `academic/periods.php`, `academic/close_period.php`.
 *
 * State machine: `open` → `closed` → `bulletins_generated`, plus
 * `closed` → `open` (reopen). Grades can only be recorded while `open`.
 * "At most one open period per year" and "no overlaps" involve several
 * periods, so they are enforced by {@link PeriodCalendar}.
 */
export class AcademicPeriod extends Entity<AcademicPeriodProps> {
  private constructor(id: EntityId, props: AcademicPeriodProps) {
    super(id, props);
  }

  static create(input: PeriodSchedule & { academicYear: number; open: boolean }): AcademicPeriod {
    const academicYear = assertAcademicYear(input.academicYear);
    return new AcademicPeriod(null, {
      ...AcademicPeriod.validate(input, academicYear),
      academicYear,
      status: input.open ? 'open' : 'closed',
      closedAt: null,
    });
  }

  static restore(id: number, props: AcademicPeriodProps): AcademicPeriod {
    return new AcademicPeriod(id, { ...props });
  }

  get name(): string {
    return this.props.name;
  }
  get academicYear(): number {
    return this.props.academicYear;
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
  get closedAt(): Date | null {
    return this.props.closedAt;
  }
  get isOpen(): boolean {
    return this.props.status === 'open';
  }
  get hasBulletins(): boolean {
    return this.props.status === 'bulletins_generated';
  }

  /** Renames or changes the dates; locked once report cards were generated. */
  reschedule(schedule: PeriodSchedule): void {
    if (this.hasBulletins) {
      throw new BusinessRuleViolationError(
        'No se puede modificar un período con boletines generados.',
        'PERIOD_LOCKED',
      );
    }
    Object.assign(this.props, AcademicPeriod.validate(schedule, this.props.academicYear));
  }

  /** `open` → `closed`: teachers can no longer record grades. */
  close(at: Date): void {
    this.transition(['open'], 'closed');
    this.props.closedAt = at;
  }

  /** `closed` → `open`. The caller closes any other open period of the year first. */
  reopen(): void {
    this.transition(['closed'], 'open');
    this.props.closedAt = null;
  }

  /** `closed` (or already generated, to regenerate) → `bulletins_generated` (B18: never from `open`). */
  markBulletinsGenerated(): void {
    this.transition(['closed', 'bulletins_generated'], 'bulletins_generated');
  }

  overlaps(other: AcademicPeriod): boolean {
    return this.startDate <= other.endDate && other.startDate <= this.endDate;
  }

  private transition(from: readonly PeriodStatus[], to: PeriodStatus): void {
    if (!from.includes(this.props.status)) {
      throw new BusinessRuleViolationError(
        `El período "${this.props.name}" está en estado "${this.props.status}" y no puede pasar a "${to}".`,
        'INVALID_PERIOD_TRANSITION',
        { from: this.props.status, to },
      );
    }
    this.props.status = to;
  }

  private static validate(schedule: PeriodSchedule, academicYear: number): PeriodSchedule {
    const name = schedule.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 50, 'nombre');
    const startDate = assertIsoDate(schedule.startDate, 'fecha de inicio');
    const endDate = assertIsoDate(schedule.endDate, 'fecha de fin');
    if (endDate < startDate) {
      throw new BusinessRuleViolationError(
        'La fecha de fin del período no puede ser anterior a la de inicio.',
        'INVERTED_DATES',
      );
    }
    if (yearOfDate(startDate) !== academicYear) {
      throw new BusinessRuleViolationError(
        `El período debe iniciar dentro del año lectivo ${academicYear}.`,
        'PERIOD_OUTSIDE_YEAR',
      );
    }
    return { name, startDate, endDate };
  }
}
