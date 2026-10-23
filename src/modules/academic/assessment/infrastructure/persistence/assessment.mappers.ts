import { ComponentScores } from '../../domain/component-scores.js';
import { ReportCard } from '../../domain/report-card.js';
import { StudentGrade } from '../../domain/student-grade.js';
import { StudentBulletinOrmEntity, StudentGradeOrmEntity } from './assessment.orm-entities.js';

/** Row ↔ aggregate translation for grades and report cards. */
export const AssessmentMapper = {
  /** Only rows with `period_id` are loaded (legacy rows without it are not addressable). */
  toGrade: (row: StudentGradeOrmEntity): StudentGrade =>
    StudentGrade.restore(row.id, {
      studentId: row.studentId,
      subjectId: row.subjectId,
      periodId: row.periodId as number,
      academicYear: Number(row.academicYear),
      periodNumber: row.periodNumber,
      scores: ComponentScores.of({
        cognitive: row.scoreCognitive,
        procedural: row.scoreProcedural,
        attitudinal: row.scoreAttitudinal,
      }),
      observations: row.observations,
    }),

  fromGrade: (grade: StudentGrade): StudentGradeOrmEntity => {
    const row = new StudentGradeOrmEntity();
    if (grade.id !== null) row.id = grade.id;
    row.studentId = grade.studentId;
    row.subjectId = grade.subjectId;
    row.periodId = grade.periodId;
    row.academicYear = grade.academicYear;
    row.periodNumber = grade.periodNumber;
    row.scoreCognitive = grade.scores.cognitive.toNumber();
    row.scoreProcedural = grade.scores.procedural.toNumber();
    row.scoreAttitudinal = grade.scores.attitudinal.toNumber();
    row.finalScore = grade.finalScore.toNumber();
    row.observations = grade.observations;
    return row;
  },

  toReportCard: (row: StudentBulletinOrmEntity): ReportCard =>
    ReportCard.restore(row.id, {
      studentId: row.studentId,
      periodId: row.periodId,
      documentPath: row.pdfPath,
      averageScore: row.averageScore ?? 0,
      generatedAt: row.generatedAt ?? new Date(0),
      viewCount: row.downloadCount ?? 0,
      lastViewedAt: row.lastDownloadAt,
    }),

  fromReportCard: (card: ReportCard): StudentBulletinOrmEntity => {
    const row = new StudentBulletinOrmEntity();
    if (card.id !== null) row.id = card.id;
    row.studentId = card.studentId;
    row.periodId = card.periodId;
    row.pdfPath = card.documentPath;
    row.averageScore = card.averageScore;
    row.generatedAt = card.generatedAt;
    row.downloadCount = card.viewCount;
    row.lastDownloadAt = card.lastViewedAt;
    return row;
  },
};
