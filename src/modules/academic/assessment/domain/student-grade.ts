import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import type { ComponentScores } from './component-scores.js';
import type { Score } from './score.js';

export interface StudentGradeProps {
  studentId: number;
  subjectId: number;
  periodId: number;
  academicYear: number;
  /** 1-based position of the period in its year (legacy `period` column, NOT NULL). */
  periodNumber: number;
  scores: ComponentScores;
  observations: string | null;
}

export interface RecordGradeInput {
  studentId: number;
  subjectId: number;
  periodId: number;
  academicYear: number;
  periodNumber: number;
  scores: ComponentScores;
  observations?: string | null;
}

export const MAX_OBSERVATIONS_LENGTH = 500;

/**
 * Grade of a student in a subject for a period (`student_grades`, the real
 * source of truth — `grades_records`/`report_cards` are dead legacy tables).
 * The final score is always derived from the components, never typed in.
 */
export class StudentGrade extends Entity<StudentGradeProps> {
  private constructor(id: EntityId, props: StudentGradeProps) {
    super(id, props);
  }

  static record(input: RecordGradeInput): StudentGrade {
    return new StudentGrade(null, {
      studentId: input.studentId,
      subjectId: input.subjectId,
      periodId: input.periodId,
      academicYear: input.academicYear,
      periodNumber: input.periodNumber,
      scores: input.scores,
      observations: StudentGrade.cleanObservations(input.observations),
    });
  }

  static restore(id: number, props: StudentGradeProps): StudentGrade {
    return new StudentGrade(id, { ...props });
  }

  get studentId(): number {
    return this.props.studentId;
  }
  get subjectId(): number {
    return this.props.subjectId;
  }
  get periodId(): number {
    return this.props.periodId;
  }
  get academicYear(): number {
    return this.props.academicYear;
  }
  get periodNumber(): number {
    return this.props.periodNumber;
  }
  get scores(): ComponentScores {
    return this.props.scores;
  }
  get observations(): string | null {
    return this.props.observations;
  }
  get finalScore(): Score {
    return this.props.scores.finalScore();
  }

  /** Replaces the components and observation (upsert of the grade sheet). */
  regrade(scores: ComponentScores, observations?: string | null, periodNumber = this.props.periodNumber): void {
    this.props.scores = scores;
    this.props.observations = StudentGrade.cleanObservations(observations);
    this.props.periodNumber = periodNumber;
  }

  private static cleanObservations(observations: string | null | undefined): string | null {
    const text = observations?.trim() || null;
    Guard.againstMaxLength(text, MAX_OBSERVATIONS_LENGTH, 'observaciones');
    return text;
  }
}
