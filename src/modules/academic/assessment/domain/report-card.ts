import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

export interface ReportCardProps {
  studentId: number;
  periodId: number;
  /** API path of the printable document (`pdf_path`). */
  documentPath: string;
  /** Average of final scores with two decimals. */
  averageScore: number;
  generatedAt: Date;
  viewCount: number;
  lastViewedAt: Date | null;
}

/**
 * Report card of a student for a period (`student_bulletins`). Generated in
 * batch for a closed period; regenerating overwrites the average.
 * Fixes B3 (the legacy update hit every row) and B23 (views are counted when
 * the student or guardian opens the report card).
 */
export class ReportCard extends Entity<ReportCardProps> {
  private constructor(id: EntityId, props: ReportCardProps) {
    super(id, props);
  }

  /** Relative API path of the PDF (legacy stored a PHP view URL, B30). */
  static documentPathFor(studentId: number, periodId: number): string {
    return `academic/report-cards/${studentId}/${periodId}/pdf`;
  }

  static generate(input: { studentId: number; periodId: number; averageScore: number; at: Date }): ReportCard {
    Guard.inRange(input.averageScore, 0, 5, 'promedio');
    return new ReportCard(null, {
      studentId: input.studentId,
      periodId: input.periodId,
      documentPath: ReportCard.documentPathFor(input.studentId, input.periodId),
      averageScore: input.averageScore,
      generatedAt: input.at,
      viewCount: 0,
      lastViewedAt: null,
    });
  }

  static restore(id: number, props: ReportCardProps): ReportCard {
    return new ReportCard(id, { ...props });
  }

  get studentId(): number {
    return this.props.studentId;
  }
  get periodId(): number {
    return this.props.periodId;
  }
  get documentPath(): string {
    return this.props.documentPath;
  }
  get averageScore(): number {
    return this.props.averageScore;
  }
  get generatedAt(): Date {
    return this.props.generatedAt;
  }
  get viewCount(): number {
    return this.props.viewCount;
  }
  get lastViewedAt(): Date | null {
    return this.props.lastViewedAt;
  }

  regenerate(averageScore: number, at: Date): void {
    Guard.inRange(averageScore, 0, 5, 'promedio');
    this.props.averageScore = averageScore;
    this.props.generatedAt = at;
    this.props.documentPath = ReportCard.documentPathFor(this.props.studentId, this.props.periodId);
  }

  registerView(at: Date): void {
    this.props.viewCount += 1;
    this.props.lastViewedAt = at;
  }
}
