import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

export const EDUCATION_LEVELS = ['preescolar', 'primaria', 'secundaria', 'media'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const DEFAULT_EDUCATION_LEVEL: EducationLevel = 'primaria';

export interface GradeProps {
  name: string;
  level: EducationLevel;
}

export interface GradeData {
  name: string;
  level?: EducationLevel;
}

/**
 * Curricular level ("Primero", "Transición"…) — a permanent catalog without
 * academic year (`grades`). Legacy: `academic/index.php` (create/edit_grade).
 */
export class Grade extends Entity<GradeProps> {
  private constructor(id: EntityId, props: GradeProps) {
    super(id, props);
  }

  static create(data: GradeData): Grade {
    return new Grade(null, Grade.validate(data));
  }

  static restore(id: number, props: GradeProps): Grade {
    return new Grade(id, { ...props });
  }

  get name(): string {
    return this.props.name;
  }

  get level(): EducationLevel {
    return this.props.level;
  }

  update(data: GradeData): void {
    Object.assign(this.props, Grade.validate(data));
  }

  private static validate(data: GradeData): GradeProps {
    const name = data.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 100, 'nombre');
    const level = data.level ?? DEFAULT_EDUCATION_LEVEL;
    Guard.oneOf(level, EDUCATION_LEVELS, 'nivel');
    return { name, level };
  }
}
