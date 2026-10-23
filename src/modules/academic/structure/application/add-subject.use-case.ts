import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  GRADE_REPOSITORY,
  type GradeRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
} from '../domain/structure.repositories.js';
import { Subject, type SubjectData } from '../domain/subject.js';
import { toSubjectView, type SubjectView } from './structure-views.js';

export interface AddSubjectInput extends SubjectData {
  gradeId: number;
}

/** Adds a subject to a grade's curriculum (legacy `academic/subjects.php`, id = 0). */
@Injectable()
export class AddSubjectUseCase implements UseCase<AddSubjectInput, SubjectView> {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
  ) {}

  async execute({ gradeId, ...data }: AddSubjectInput): Promise<SubjectView> {
    requireFound(await this.grades.findById(gradeId), 'Grado', gradeId);
    const subject = Subject.create(gradeId, data);
    await this.subjects.save(subject);
    return toSubjectView(subject);
  }
}
