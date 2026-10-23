import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Grade, type GradeData } from '../domain/grade.js';
import { GRADE_REPOSITORY, type GradeRepository } from '../domain/structure.repositories.js';
import { toGradeView, type GradeView } from './structure-views.js';

/** Creates a grade (legacy `academic/index.php` action `create_grade`). */
@Injectable()
export class CreateGradeUseCase implements UseCase<GradeData, GradeView> {
  constructor(@Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository) {}

  async execute(input: GradeData): Promise<GradeView> {
    const grade = Grade.create(input);
    await this.grades.save(grade);
    return toGradeView(grade);
  }
}
