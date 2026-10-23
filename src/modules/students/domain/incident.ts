import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { optionalText, requiredText } from './catalogs.js';

/** Request types (`incidents.type`). */
export const INCIDENT_TYPES = [
  'incapacidad',
  'salida_clase',
  'firma_libro',
  'izada_bandera',
  'baja_estudiante',
  'ajuste_pago',
  'cierre_caja',
  'otra',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

/** Types a student or guardian may report from the portal (cash closing is a staff-only request). */
export const PORTAL_INCIDENT_TYPES: readonly IncidentType[] = INCIDENT_TYPES.filter((type) => type !== 'cierre_caja');

export const INCIDENT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

export const INCIDENT_STATUSES = ['pending', 'in_review', 'approved', 'rejected', 'closed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Statuses a reviewer can move an incident to. */
export type ReviewAction = Exclude<IncidentStatus, 'pending'>;
export const REVIEW_ACTIONS: readonly ReviewAction[] = ['in_review', 'approved', 'rejected', 'closed'];

/**
 * Allowed transitions (analysis 03 rule 36): review actions only from
 * `pending`/`in_review`; `closed` only after a decision. Legacy
 * `incidents/index.php:51-66` accepted any status change (security S7).
 */
const TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  pending: ['in_review', 'approved', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['closed'],
  rejected: ['closed'],
  closed: [],
};

export interface IncidentProps {
  studentId: number | null;
  requestedBy: number | null;
  reviewedBy: number | null;
  type: IncidentType;
  priority: IncidentPriority;
  title: string;
  description: string | null;
  reviewNotes: string | null;
  status: IncidentStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface OpenIncidentProps {
  studentId: number | null;
  requestedBy: number;
  type?: IncidentType;
  priority?: IncidentPriority;
  title: string;
  description?: string | null;
  openedAt: Date;
}

/**
 * Request with an approval workflow (`incidents` table): sick leave, early
 * leave, withdrawal, payment adjustment, cash closing…
 * Approving has no side effects on other aggregates (legacy behaviour).
 */
export class Incident extends Entity<IncidentProps> {
  private constructor(id: EntityId, props: IncidentProps) {
    super(id, props);
  }

  static open(input: OpenIncidentProps): Incident {
    const type = input.type ?? 'otra';
    const priority = input.priority ?? 'medium';
    Guard.oneOf(type, INCIDENT_TYPES, 'tipo de incidencia');
    Guard.oneOf(priority, INCIDENT_PRIORITIES, 'prioridad');
    return new Incident(null, {
      studentId: input.studentId,
      requestedBy: input.requestedBy,
      reviewedBy: null,
      type,
      priority,
      title: requiredText(input.title, 255, 'título'),
      description: optionalText(input.description, 65_535, 'descripción'),
      reviewNotes: null,
      status: 'pending',
      createdAt: input.openedAt,
      updatedAt: input.openedAt,
    });
  }

  static restore(id: number, props: IncidentProps): Incident {
    return new Incident(id, { ...props });
  }

  get studentId(): number | null {
    return this.props.studentId;
  }
  get requestedBy(): number | null {
    return this.props.requestedBy;
  }
  get reviewedBy(): number | null {
    return this.props.reviewedBy;
  }
  get type(): IncidentType {
    return this.props.type;
  }
  get priority(): IncidentPriority {
    return this.props.priority;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string | null {
    return this.props.description;
  }
  get reviewNotes(): string | null {
    return this.props.reviewNotes;
  }
  get status(): IncidentStatus {
    return this.props.status;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  /** True while a reviewer can still decide (approve/reject/put in review). */
  get isOpen(): boolean {
    return this.props.status === 'pending' || this.props.status === 'in_review';
  }

  /** Applies a review action enforcing the state machine; records reviewer and notes. */
  review(action: ReviewAction, reviewerId: number, notes: string | null | undefined, at: Date): void {
    Guard.oneOf(action, REVIEW_ACTIONS, 'acción');
    if (!TRANSITIONS[this.props.status].includes(action)) {
      throw new BusinessRuleViolationError(
        `No se puede pasar una incidencia de "${this.props.status}" a "${action}".`,
        'INVALID_INCIDENT_TRANSITION',
        { from: this.props.status, to: action },
      );
    }
    this.props.status = action;
    this.props.reviewedBy = reviewerId;
    this.props.reviewNotes = optionalText(notes, 65_535, 'notas de revisión');
    this.props.updatedAt = at;
  }
}
