import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GRADE_REPOSITORY,
  type GradeRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
} from '../domain/structure.repositories.js';

/**
 * Deletes an unused grade. The legacy physical delete cascaded to classrooms,
 * subjects, assignments and every grade recorded (§2.1); now it is blocked
 * while the grade still has classrooms or subjects.
 */
@Injectable()
export class DeleteGradeUseCase implements UseCase<number, void> {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
  ) {}

  async execute(gradeId: number): Promise<void> {
    const grade = requireFound(await this.grades.findById(gradeId), 'Grado', gradeId);
    const [classrooms, subjects] = await Promise.all([
      this.classrooms.countByGrade(gradeId),
      this.subjects.listByGrade(gradeId),
    ]);
    if (classrooms > 0 || subjects.length > 0) {
      throw new ConflictError(
        `El grado "${grade.name}" tiene ${classrooms} salón(es) y ${subjects.length} materia(s); elimínelos primero.`,
        { classrooms, subjects: subjects.length },
      );
    }
    await this.grades.delete(gradeId);
  }
}
