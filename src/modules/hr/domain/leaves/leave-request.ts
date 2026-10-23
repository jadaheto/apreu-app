import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { CalendarDate, type IsoDate } from '../common/calendar-date.js';

/** `employee_leaves.leave_type` (paternidad and no remunerada added by migration hr-001). */
export const LEAVE_TYPES = [
  'vacaciones',
  'licencia_medica',
  'licencia_maternidad',
  'licencia_paternidad',
  'licencia_no_remunerada',
  'permiso_sindical',
  'calamidad',
  'comision',
  'otro',
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/**
 * How an approved absence is paid in the payroll (analysis L-2, L-13):
 * - `paid`: salary at 100 %, no transport allowance (vacaciones, licencias de
 *   maternidad/paternidad que el empleador paga y recobra a la EPS, permisos
 *   remunerados, calamidad doméstica).
 * - `incapacity`: incapacidad por enfermedad general, 2/3 of the salary and
 *   never less than the daily minimum wage, no transport allowance.
 * - `unpaid`: licencia no remunerada, neither salary nor transport.
 * - `worked`: comisión de servicios, counts as a worked day.
 */
export type LeavePayTreatment = 'paid' | 'incapacity' | 'unpaid' | 'worked';

export const LEAVE_PAY_TREATMENT: Readonly<Record<LeaveType, LeavePayTreatment>> = {
  vacaciones: 'paid',
  licencia_medica: 'incapacity',
  licencia_maternidad: 'paid',
  licencia_paternidad: 'paid',
  licencia_no_remunerada: 'unpaid',
  permiso_sindical: 'paid',
  calamidad: 'paid',
  comision: 'worked',
  otro: 'paid',
};

export interface LeaveRequestProps {
  employeeId: number;
  leaveType: LeaveType;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string;
  status: LeaveStatus;
  requestedBy: number | null;
  decidedBy: number | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date | null;
}

export interface NewLeaveRequest {
  employeeId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  requestedBy: number;
}

/**
 * Permission / absence request (`employee_leaves`). New approval workflow
 * (legacy B-22 had none):
 *
 * PENDING ─approve─► APPROVED ─cancel (HR)─► CANCELLED
 *    ├─reject (reason)─► REJECTED
 *    └─cancel─► CANCELLED
 *
 * "Taken" is derived: an approved leave whose end date has passed.
 */
export class LeaveRequest extends Entity<LeaveRequestProps> {
  private constructor(id: EntityId, props: LeaveRequestProps) {
    super(id, props);
  }

  static create(input: NewLeaveRequest): LeaveRequest {
    Guard.oneOf(input.leaveType, LEAVE_TYPES, 'tipo de permiso');
    const startDate = CalendarDate.assert(input.startDate, 'fecha inicial');
    const endDate = CalendarDate.assert(input.endDate, 'fecha final');
    if (endDate < startDate) {
      throw new BusinessRuleViolationError('La fecha final no puede ser anterior a la inicial.', 'INVERTED_DATES');
    }
    const reason = input.reason?.trim();
    Guard.againstEmpty(reason, 'motivo');
    Guard.againstMaxLength(reason, 2000, 'motivo');
    return new LeaveRequest(null, {
      employeeId: input.employeeId,
      leaveType: input.leaveType,
      startDate,
      endDate,
      reason,
      status: 'pending',
      requestedBy: input.requestedBy,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: null,
    });
  }

  static restore(id: number, props: LeaveRequestProps): LeaveRequest {
    return new LeaveRequest(id, { ...props });
  }

  get employeeId(): number {
    return this.props.employeeId;
  }
  get leaveType(): LeaveType {
    return this.props.leaveType;
  }
  get startDate(): IsoDate {
    return this.props.startDate;
  }
  get endDate(): IsoDate {
    return this.props.endDate;
  }
  get reason(): string {
    return this.props.reason;
  }
  get status(): LeaveStatus {
    return this.props.status;
  }
  get requestedBy(): number | null {
    return this.props.requestedBy;
  }
  get decidedBy(): number | null {
    return this.props.decidedBy;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  get decisionNote(): string | null {
    return this.props.decisionNote;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Calendar days, both ends inclusive (legacy rule 28). */
  get days(): number {
    return CalendarDate.calendarDaysInclusive(this.props.startDate, this.props.endDate);
  }

  get payTreatment(): LeavePayTreatment {
    return LEAVE_PAY_TREATMENT[this.props.leaveType];
  }

  /** Approved and already finished on `today`. */
  isTaken(today: IsoDate): boolean {
    return this.props.status === 'approved' && this.props.endDate < today;
  }

  overlaps(start: IsoDate, end: IsoDate): boolean {
    return CalendarDate.rangesOverlap(this.props.startDate, this.props.endDate, start, end);
  }

  approve(by: number, at: Date, note?: string | null): void {
    this.ensurePending('aprobar');
    this.decide('approved', by, at, note?.trim() || null);
  }

  reject(by: number, at: Date, reason: string): void {
    this.ensurePending('rechazar');
    const trimmed = reason?.trim();
    Guard.againstEmpty(trimmed, 'motivo del rechazo');
    Guard.againstMaxLength(trimmed, 255, 'motivo del rechazo');
    this.decide('rejected', by, at, trimmed);
  }

  /**
   * The employee may cancel a pending request; HR may also cancel an approved
   * one that has not finished yet.
   */
  cancel(by: number, at: Date, today: IsoDate, byHumanResources: boolean): void {
    const cancellable =
      this.props.status === 'pending' ||
      (byHumanResources && this.props.status === 'approved' && this.props.endDate >= today);
    if (!cancellable) {
      throw new BusinessRuleViolationError('Esta solicitud ya no se puede cancelar.', 'LEAVE_NOT_CANCELLABLE', {
        status: this.props.status,
      });
    }
    this.decide('cancelled', by, at, null);
  }

  private ensurePending(action: string): void {
    if (this.props.status !== 'pending') {
      throw new BusinessRuleViolationError(`Solo se puede ${action} una solicitud pendiente.`, 'LEAVE_NOT_PENDING', {
        status: this.props.status,
      });
    }
  }

  private decide(status: LeaveStatus, by: number, at: Date, note: string | null): void {
    this.props.status = status;
    this.props.decidedBy = by;
    this.props.decidedAt = at;
    this.props.decisionNote = note;
  }
}
