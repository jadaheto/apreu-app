import { Injectable } from '@nestjs/common';
import { type FindOptionsWhere, In } from 'typeorm';
import { ConflictError } from '../../../../../shared/domain/domain-error.js';
import { isUniqueViolation } from '../../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { Classroom } from '../../domain/classroom.js';
import { EDUCATION_LEVELS, type Grade } from '../../domain/grade.js';
import type { GroupDirectorship } from '../../domain/group-directorship.js';
import type {
  ClassroomRepository,
  GradeRepository,
  GroupDirectorshipRepository,
  SubjectRepository,
  TeachingAssignmentRepository,
} from '../../domain/structure.repositories.js';
import type { Subject } from '../../domain/subject.js';
import type { TeachingAssignment } from '../../domain/teaching-assignment.js';
import { StructureMapper } from './structure.mappers.js';
import {
  ClassroomOrmEntity,
  GradeOrmEntity,
  GroupDirectorOrmEntity,
  SubjectOrmEntity,
  TeacherAssignmentOrmEntity,
} from './structure.orm-entities.js';

const levelRank = (level: string): number => {
  const rank = EDUCATION_LEVELS.indexOf(level as (typeof EDUCATION_LEVELS)[number]);
  return rank === -1 ? EDUCATION_LEVELS.length : rank;
};

@Injectable()
export class TypeOrmGradeRepository implements GradeRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Grade | null> {
    const row = await (await this.db.repository(GradeOrmEntity)).findOneBy({ id });
    return row ? StructureMapper.toGrade(row) : null;
  }

  async findByIds(ids: readonly number[]): Promise<Grade[]> {
    if (ids.length === 0) return [];
    return (await (await this.db.repository(GradeOrmEntity)).findBy({ id: In([...ids]) })).map(StructureMapper.toGrade);
  }

  async listAll(): Promise<Grade[]> {
    const rows = await (await this.db.repository(GradeOrmEntity)).find();
    return rows
      .sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.name.localeCompare(b.name, 'es'))
      .map(StructureMapper.toGrade);
  }

  async save(grade: Grade): Promise<void> {
    const saved = await (await this.db.repository(GradeOrmEntity)).save(StructureMapper.fromGrade(grade));
    if (grade.isNew) grade.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(GradeOrmEntity)).delete({ id });
  }
}

@Injectable()
export class TypeOrmSubjectRepository implements SubjectRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Subject | null> {
    const row = await (await this.db.repository(SubjectOrmEntity)).findOneBy({ id });
    return row ? StructureMapper.toSubject(row) : null;
  }

  async findByIds(ids: readonly number[]): Promise<Subject[]> {
    if (ids.length === 0) return [];
    return (await (await this.db.repository(SubjectOrmEntity)).findBy({ id: In([...ids]) })).map(
      StructureMapper.toSubject,
    );
  }

  async listByGrade(gradeId: number): Promise<Subject[]> {
    const rows = await (
      await this.db.repository(SubjectOrmEntity)
    ).find({
      where: { gradeId },
      order: { area: 'ASC', name: 'ASC' },
    });
    return rows.map(StructureMapper.toSubject);
  }

  async countByGrade(): Promise<Map<number, number>> {
    const rows: { gradeId: number; total: string }[] = await (
      await this.db.repository(SubjectOrmEntity)
    )
      .createQueryBuilder('s')
      .select('s.grade_id', 'gradeId')
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('s.grade_id')
      .getRawMany();
    return new Map(rows.map((row) => [Number(row.gradeId), Number(row.total)]));
  }

  async hasAcademicRecords(subjectId: number): Promise<boolean> {
    const rows: { used: boolean }[] = await (
      await this.db.manager()
    ).query(
      `SELECT (EXISTS(SELECT 1 FROM student_grades WHERE subject_id = $1)
            OR EXISTS(SELECT 1 FROM teacher_assignments WHERE subject_id = $1)) AS used`,
      [subjectId],
    );
    return rows[0]?.used === true;
  }

  async save(subject: Subject): Promise<void> {
    const saved = await (await this.db.repository(SubjectOrmEntity)).save(StructureMapper.fromSubject(subject));
    if (subject.isNew) subject.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(SubjectOrmEntity)).delete({ id });
  }
}

@Injectable()
export class TypeOrmClassroomRepository implements ClassroomRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Classroom | null> {
    const row = await (await this.db.repository(ClassroomOrmEntity)).findOneBy({ id });
    return row ? StructureMapper.toClassroom(row) : null;
  }

  async findByIds(ids: readonly number[]): Promise<Classroom[]> {
    if (ids.length === 0) return [];
    return (await (await this.db.repository(ClassroomOrmEntity)).findBy({ id: In([...ids]) })).map(
      StructureMapper.toClassroom,
    );
  }

  async listByYear(year: number): Promise<Classroom[]> {
    const rows = await (
      await this.db.repository(ClassroomOrmEntity)
    ).find({
      where: { academicYear: year },
      order: { name: 'ASC' },
    });
    return rows.map(StructureMapper.toClassroom);
  }

  async countByGrade(gradeId: number): Promise<number> {
    return (await this.db.repository(ClassroomOrmEntity)).countBy({ gradeId });
  }

  async save(classroom: Classroom): Promise<void> {
    const saved = await (await this.db.repository(ClassroomOrmEntity)).save(StructureMapper.fromClassroom(classroom));
    if (classroom.isNew) classroom.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(ClassroomOrmEntity)).delete({ id });
  }
}

@Injectable()
export class TypeOrmTeachingAssignmentRepository implements TeachingAssignmentRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<TeachingAssignment | null> {
    const row = await (await this.db.repository(TeacherAssignmentOrmEntity)).findOneBy({ id });
    return row ? StructureMapper.toAssignment(row) : null;
  }

  async findOne(subjectId: number, classroomId: number, year: number): Promise<TeachingAssignment | null> {
    const row = await (
      await this.db.repository(TeacherAssignmentOrmEntity)
    ).findOne({
      where: { subjectId, classroomId, academicYear: year },
      order: { id: 'DESC' },
    });
    return row ? StructureMapper.toAssignment(row) : null;
  }

  async listByClassroom(classroomId: number, year: number): Promise<TeachingAssignment[]> {
    return this.list({ classroomId, academicYear: year });
  }

  async listByClassrooms(classroomIds: readonly number[], year: number): Promise<TeachingAssignment[]> {
    if (classroomIds.length === 0) return [];
    return this.list({ classroomId: In([...classroomIds]), academicYear: year });
  }

  async listByEmployee(employeeId: number, year: number): Promise<TeachingAssignment[]> {
    return this.list({ employeeId, academicYear: year });
  }

  async countByYear(year: number): Promise<number> {
    return (await this.db.repository(TeacherAssignmentOrmEntity)).countBy({ academicYear: year });
  }

  async countByClassroom(classroomId: number): Promise<number> {
    return (await this.db.repository(TeacherAssignmentOrmEntity)).countBy({ classroomId });
  }

  async save(assignment: TeachingAssignment): Promise<void> {
    try {
      const repository = await this.db.repository(TeacherAssignmentOrmEntity);
      const saved = await repository.save(StructureMapper.fromAssignment(assignment));
      if (assignment.isNew) assignment.assignId(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('Esta materia ya tiene un docente asignado en este salón.');
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(TeacherAssignmentOrmEntity)).delete({ id });
  }

  private async list(where: FindOptionsWhere<TeacherAssignmentOrmEntity>): Promise<TeachingAssignment[]> {
    const rows = await (await this.db.repository(TeacherAssignmentOrmEntity)).find({ where, order: { id: 'ASC' } });
    return rows.map(StructureMapper.toAssignment);
  }
}

@Injectable()
export class TypeOrmGroupDirectorshipRepository implements GroupDirectorshipRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findActiveByClassroom(classroomId: number): Promise<GroupDirectorship | null> {
    const row = await (
      await this.db.repository(GroupDirectorOrmEntity)
    ).findOne({
      where: { classroomId, isActive: true },
      order: { id: 'DESC' },
    });
    return row ? StructureMapper.toDirectorship(row) : null;
  }

  async listActiveByClassrooms(classroomIds: readonly number[]): Promise<GroupDirectorship[]> {
    if (classroomIds.length === 0) return [];
    const rows = await (
      await this.db.repository(GroupDirectorOrmEntity)
    ).findBy({
      classroomId: In([...classroomIds]),
      isActive: true,
    });
    return rows.map(StructureMapper.toDirectorship);
  }

  async listActiveByEmployee(employeeId: number): Promise<GroupDirectorship[]> {
    const rows = await (await this.db.repository(GroupDirectorOrmEntity)).findBy({ employeeId, isActive: true });
    return rows.map(StructureMapper.toDirectorship);
  }

  async save(directorship: GroupDirectorship): Promise<void> {
    try {
      const saved = await (
        await this.db.repository(GroupDirectorOrmEntity)
      ).save(StructureMapper.fromDirectorship(directorship));
      if (directorship.isNew) directorship.assignId(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('El salón ya tiene un director de grupo activo.');
      throw error;
    }
  }
}
