import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { GRADE_REPOSITORY, type GradeRepository } from '../domain/structure.repositories.js';
import { toGradeView, type GradeView } from './structure-views.js';

/** Lists the grade catalog ordered by level and name (legacy `academic/subjects.php` tabs). */
@Injectable()
export class ListGradesUseCase implements UseCase<void, GradeView[]> {
  constructor(@Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository) {}

  async execute(): Promise<GradeView[]> {
    return (await this.grades.listAll()).map(toGradeView);
  }
}
