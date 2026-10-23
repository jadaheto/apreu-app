import { Injectable } from '@nestjs/common';
import { Brackets, In } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { likePattern, unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { StudentDocumentType } from '../../domain/catalogs.js';
import type { Student } from '../../domain/student.js';
import type { StudentRepository, StudentSearchCriteria } from '../../domain/student.repository.js';
import { StudentMapper } from './mappers.js';
import { StudentOrmEntity } from './student.orm-entity.js';

/** TypeORM adapter of {@link StudentRepository}. */
@Injectable()
export class TypeOrmStudentRepository implements StudentRepository {
  constructor(private readonly db: TenantDataSource) {}

  private repository() {
    return this.db.repository(StudentOrmEntity);
  }

  async findById(id: number): Promise<Student | null> {
    const row = await (await this.repository()).findOneBy({ id });
    return row ? StudentMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<Student[]> {
    if (ids.length === 0) return [];
    return (await (await this.repository()).findBy({ id: In(ids) })).map(StudentMapper.toDomain);
  }

  /**
   * Case-insensitive on the number (ADR-0008): MariaDB's `utf8mb4_general_ci`
   * treated `ab123` and `AB123` (passports, foreign IDs) as the same document.
   */
  async findByDocument(documentType: StudentDocumentType, documentNumber: string): Promise<Student | null> {
    const row = await (
      await this.repository()
    )
      .createQueryBuilder('s')
      .where('s.document_type = :documentType', { documentType })
      .andWhere('upper(s.document_number) = upper(:documentNumber)', { documentNumber: documentNumber.trim() })
      .orderBy('s.id', 'ASC')
      .getOne();
    return row ? StudentMapper.toDomain(row) : null;
  }

  async findByUserId(userId: number): Promise<Student | null> {
    const row = await (await this.repository()).findOneBy({ userId });
    return row ? StudentMapper.toDomain(row) : null;
  }

  async findByGuardianId(guardianId: number): Promise<Student[]> {
    const rows = await (
      await this.repository()
    ).find({
      where: { guardianId },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return rows.map(StudentMapper.toDomain);
  }

  async existsByCode(code: string): Promise<boolean> {
    return (await this.repository()).exists({ where: { code } });
  }

  async search(criteria: StudentSearchCriteria, page: PageRequest): Promise<Paginated<Student>> {
    const query = (await this.repository()).createQueryBuilder('s');
    if (criteria.status) query.andWhere('s.status = :status', { status: criteria.status });
    if (criteria.classroomId)
      query.andWhere('s.classroom_id = :classroomId', {
        classroomId: criteria.classroomId,
      });
    if (criteria.gradeId) {
      query.andWhere('s.classroom_id IN (SELECT c.id FROM classrooms c WHERE c.grade_id = :gradeId)', {
        gradeId: criteria.gradeId,
      });
    }
    if (criteria.academicYear) {
      query.andWhere(
        '(s.classroom_id IS NULL OR s.classroom_id IN (SELECT c.id FROM classrooms c WHERE c.academic_year = :year))',
        { year: criteria.academicYear },
      );
    }
    if (criteria.search?.trim()) {
      const term = likePattern(criteria.search);
      query.andWhere(
        new Brackets((q) =>
          q
            .where(unaccentLike("s.first_name || ' ' || s.last_name", ':term'), { term })
            .orWhere(unaccentLike('s.code', ':term'), { term })
            .orWhere(unaccentLike('s.document_number', ':term'), { term }),
        ),
      );
    }
    const [rows, total] = await query
      .orderBy('s.last_name', 'ASC')
      .addOrderBy('s.first_name', 'ASC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return {
      items: rows.map(StudentMapper.toDomain),
      total,
      page: page.page,
      limit: page.limit,
    };
  }

  async save(student: Student): Promise<void> {
    const saved = await (await this.repository()).save(StudentMapper.toPersistence(student));
    if (student.isNew) student.assignId(saved.id);
  }
}
