import { InMemoryStore } from '../../../../shared/testing/fakes.js';
import type { ReportCardRepository, StudentGradeRepository } from '../domain/assessment.repositories.js';
import type { ReportCard } from '../domain/report-card.js';
import type { StudentGrade } from '../domain/student-grade.js';

export class InMemoryStudentGradeRepository implements StudentGradeRepository {
  readonly store = new InMemoryStore<StudentGrade>();
  saveAllCalls = 0;

  async listBySubjectAndPeriod(subjectId: number, periodId: number) {
    return this.store.all().filter((g) => g.subjectId === subjectId && g.periodId === periodId);
  }
  async listByStudentAndYear(studentId: number, academicYear: number) {
    return this.store.all().filter((g) => g.studentId === studentId && g.academicYear === academicYear);
  }
  async listByStudentAndPeriod(studentId: number, periodId: number) {
    return this.store.all().filter((g) => g.studentId === studentId && g.periodId === periodId);
  }
  async listByPeriod(periodId: number) {
    return this.store.all().filter((g) => g.periodId === periodId);
  }
  async saveAll(grades: readonly StudentGrade[]) {
    this.saveAllCalls++;
    grades.forEach((g) => this.store.save(g));
  }
}

export class InMemoryReportCardRepository implements ReportCardRepository {
  readonly store = new InMemoryStore<ReportCard>();

  async findOne(studentId: number, periodId: number) {
    return this.store.all().find((c) => c.studentId === studentId && c.periodId === periodId) ?? null;
  }
  async listByStudent(studentId: number) {
    return this.store.all().filter((c) => c.studentId === studentId);
  }
  async listByPeriod(periodId: number) {
    return this.store.all().filter((c) => c.periodId === periodId);
  }
  async save(card: ReportCard) {
    this.store.save(card);
  }
  async saveAll(cards: readonly ReportCard[]) {
    cards.forEach((c) => this.store.save(c));
  }
}
