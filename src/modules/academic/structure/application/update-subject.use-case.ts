import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { SUBJECT_REPOSITORY, type SubjectRepository } from '../domain/structure.repositories.js';
import type { SubjectData } from '../domain/subject.js';
import { toSubjectView, type SubjectView } from './structure-views.js';

export interface UpdateSubjectInput extends SubjectData {
  subjectId: number;
}

/** Edits a subject; it stays in its grade (legacy `academic/subjects.php`, id > 0). */
@Injectable()
export class UpdateSubjectUseCase implements UseCase<UpdateSubjectInput, SubjectView> {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository) {}

  async execute({ subjectId, ...data }: UpdateSubjectInput): Promise<SubjectView> {
    const subject = requireFound(await this.subjects.findById(subjectId), 'Materia', subjectId);
    subject.update(data);
    await this.subjects.save(subject);
    return toSubjectView(subject);
  }
}
