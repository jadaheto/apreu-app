import { Injectable } from '@nestjs/common';
import { type FindOptionsWhere, Not, IsNull } from 'typeorm';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ReportCardRepository, StudentGradeRepository } from '../../domain/assessment.repositories.js';
import type { ReportCard } from '../../domain/report-card.js';
import type { StudentGrade } from '../../domain/student-grade.js';
import { AssessmentMapper } from './assessment.mappers.js';
import { StudentBulletinOrmEntity, StudentGradeOrmEntity } from './assessment.orm-entities.js';

/** `student_grades` repository; reads always go through `period_id` (B7). */
@Injectable()
export class TypeOrmStudentGradeRepository implements StudentGradeRepository {
  constructor(private readonly db: TenantDataSource) {}

  listBySubjectAndPeriod(subjectId: number, periodId: number): Promise<StudentGrade[]> {
    return this.list({ subjectId, periodId });
  }

  listByStudentAndYear(studentId: number, academicYear: number): Promise<StudentGrade[]> {
    return this.list({ studentId, academicYear, periodId: Not(IsNull()) });
  }

  listByStudentAndPeriod(studentId: number, periodId: number): Promise<StudentGrade[]> {
    return this.list({ studentId, periodId });
  }

  listByPeriod(periodId: number): Promise<StudentGrade[]> {
    return this.list({ periodId });
  }

  async saveAll(grades: readonly StudentGrade[]): Promise<void> {
    if (grades.length === 0) return;
    const saved = await (await this.db.repository(StudentGradeOrmEntity)).save(grades.map(AssessmentMapper.fromGrade));
    grades.forEach((grade, index) => grade.isNew && grade.assignId(saved[index].id));
  }

  private async list(where: FindOptionsWhere<StudentGradeOrmEntity>): Promise<StudentGrade[]> {
    const rows = await (await this.db.repository(StudentGradeOrmEntity)).find({ where, order: { id: 'ASC' } });
    return rows.map(AssessmentMapper.toGrade);
  }
}

/** `student_bulletins` repository; updates target one row by id (B3). */
@Injectable()
export class TypeOrmReportCardRepository implements ReportCardRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findOne(studentId: number, periodId: number): Promise<ReportCard | null> {
    const row = await (await this.db.repository(StudentBulletinOrmEntity)).findOneBy({ studentId, periodId });
    return row ? AssessmentMapper.toReportCard(row) : null;
  }

  async listByStudent(studentId: number): Promise<ReportCard[]> {
    return (await (await this.db.repository(StudentBulletinOrmEntity)).findBy({ studentId })).map(
      AssessmentMapper.toReportCard,
    );
  }

  async listByPeriod(periodId: number): Promise<ReportCard[]> {
    return (await (await this.db.repository(StudentBulletinOrmEntity)).findBy({ periodId })).map(
      AssessmentMapper.toReportCard,
    );
  }

  async save(card: ReportCard): Promise<void> {
    await this.saveAll([card]);
  }

  async saveAll(cards: readonly ReportCard[]): Promise<void> {
    if (cards.length === 0) return;
    const saved = await (
      await this.db.repository(StudentBulletinOrmEntity)
    ).save(cards.map(AssessmentMapper.fromReportCard));
    cards.forEach((card, index) => card.isNew && card.assignId(saved[index].id));
  }
}
