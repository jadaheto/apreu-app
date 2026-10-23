import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { TEACHING_ASSIGNMENT_REPOSITORY, type TeachingAssignmentRepository } from '../domain/structure.repositories.js';

/**
 * Removes a teaching assignment (new: the legacy had no delete). Grades are
 * stored per subject, so they are kept.
 */
@Injectable()
export class RemoveAssignmentUseCase implements UseCase<number, void> {
  constructor(@Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository) {}

  async execute(assignmentId: number): Promise<void> {
    requireFound(await this.assignments.findById(assignmentId), 'Asignación docente', assignmentId);
    await this.assignments.delete(assignmentId);
  }
}
