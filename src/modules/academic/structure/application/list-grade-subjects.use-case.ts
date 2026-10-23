import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  GRADE_REPOSITORY,
  type GradeRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
} from '../domain/structure.repositories.js';
import { toGradeView, toSubjectView, type GradeView, type SubjectView } from './structure-views.js';

export interface GradeCurriculumView {
  grade: GradeView;
  subjects: SubjectView[];
}

/** Curriculum of a grade ordered by area and name (legacy `academic/subjects.php`). */
@Injectable()
export class ListGradeSubjectsUseCase implements UseCase<number, GradeCurriculumView> {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
  ) {}

  async execute(gradeId: number): Promise<GradeCurriculumView> {
    const grade = requireFound(await this.grades.findById(gradeId), 'Grado', gradeId);
    const subjects = await this.subjects.listByGrade(gradeId);
    return { grade: toGradeView(grade), subjects: subjects.map(toSubjectView) };
  }
}
