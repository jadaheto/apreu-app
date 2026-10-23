import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { assertIntegerInRange } from '../../common/domain/integer-range.js';

export interface SubjectProps {
  gradeId: number;
  name: string;
  /** Upper-case code, `''` when not given (the column is NOT NULL). */
  code: string;
  area: string | null;
  hoursPerWeek: number;
}

export interface SubjectData {
  name: string;
  code?: string | null;
  area?: string | null;
  hoursPerWeek?: number;
}

export const DEFAULT_WEEKLY_HOURS = 1;

/**
 * A subject of a grade's curriculum (`subjects`). Legacy: `academic/subjects.php`.
 * Rules: name required (≤150), optional code (≤20, upper-case), optional area
 * (≤100), weekly hours integer 1–20.
 */
export class Subject extends Entity<SubjectProps> {
  private constructor(id: EntityId, props: SubjectProps) {
    super(id, props);
  }

  static create(gradeId: number, data: SubjectData): Subject {
    Guard.againstEmpty(gradeId, 'grado');
    return new Subject(null, { gradeId, ...Subject.validate(data) });
  }

  static restore(id: number, props: SubjectProps): Subject {
    return new Subject(id, { ...props });
  }

  get gradeId(): number {
    return this.props.gradeId;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): string {
    return this.props.code;
  }
  get area(): string | null {
    return this.props.area;
  }
  get hoursPerWeek(): number {
    return this.props.hoursPerWeek;
  }

  update(data: SubjectData): void {
    Object.assign(this.props, Subject.validate(data));
  }

  private static validate(data: SubjectData): Omit<SubjectProps, 'gradeId'> {
    const name = data.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 150, 'nombre');
    const code = (data.code ?? '').trim().toUpperCase();
    Guard.againstMaxLength(code, 20, 'código');
    const area = data.area?.trim() || null;
    Guard.againstMaxLength(area, 100, 'área');
    const hoursPerWeek = assertIntegerInRange(data.hoursPerWeek ?? DEFAULT_WEEKLY_HOURS, 1, 20, 'intensidad horaria');
    return { name, code, area, hoursPerWeek };
  }
}
