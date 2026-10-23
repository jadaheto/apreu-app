import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { STAFF_DIRECTORY, type StaffDirectoryPort } from '../../common/domain/staff-directory.port.js';
import { TEACHING_ASSIGNMENT_REPOSITORY, type TeachingAssignmentRepository } from '../domain/structure.repositories.js';
import { toAssignmentView, type TeachingAssignmentView } from './assignment-view.js';
import { requireEligibleTeacher } from './teacher-eligibility.js';

export interface ChangeAssignmentTeacherInput {
  assignmentId: number;
  employeeId: number;
}

/** Replaces the teacher of an assignment (broken in the legacy UI: B6). */
@Injectable()
export class ChangeAssignmentTeacherUseCase implements UseCase<ChangeAssignmentTeacherInput, TeachingAssignmentView> {
  constructor(
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
  ) {}

  async execute({ assignmentId, employeeId }: ChangeAssignmentTeacherInput): Promise<TeachingAssignmentView> {
    const assignment = requireFound(await this.assignments.findById(assignmentId), 'Asignación docente', assignmentId);
    await requireEligibleTeacher(this.staff, employeeId);
    assignment.changeTeacher(employeeId);
    await this.assignments.save(assignment);
    return toAssignmentView(assignment);
  }
}
