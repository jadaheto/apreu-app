import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import type { GradeData } from '../domain/grade.js';
import { GRADE_REPOSITORY, type GradeRepository } from '../domain/structure.repositories.js';
import { toGradeView, type GradeView } from './structure-views.js';

export interface UpdateGradeInput extends GradeData {
  gradeId: number;
}

/** Renames a grade or changes its level (legacy action `edit_grade`). */
@Injectable()
export class UpdateGradeUseCase implements UseCase<UpdateGradeInput, GradeView> {
  constructor(@Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository) {}

  async execute({ gradeId, ...data }: UpdateGradeInput): Promise<GradeView> {
    const grade = requireFound(await this.grades.findById(gradeId), 'Grado', gradeId);
    grade.update(data);
    await this.grades.save(grade);
    return toGradeView(grade);
  }
}
