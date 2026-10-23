import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { SUBJECT_REPOSITORY, type SubjectRepository } from '../domain/structure.repositories.js';

/**
 * Removes a subject from the curriculum (new: the legacy had no delete).
 * Blocked while grades or teaching assignments reference it, so no grade is lost.
 */
@Injectable()
export class RemoveSubjectUseCase implements UseCase<number, void> {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository) {}

  async execute(subjectId: number): Promise<void> {
    const subject = requireFound(await this.subjects.findById(subjectId), 'Materia', subjectId);
    if (await this.subjects.hasAcademicRecords(subjectId)) {
      throw new ConflictError(
        `La materia "${subject.name}" tiene calificaciones o docentes asignados y no se puede eliminar.`,
      );
    }
    await this.subjects.delete(subjectId);
  }
}
