import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { schoolDateOf } from '../../common/domain/school-calendar.js';
import { STAFF_DIRECTORY, type StaffDirectoryPort } from '../../common/domain/staff-directory.port.js';
import { GroupDirectorship } from '../domain/group-directorship.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GROUP_DIRECTORSHIP_REPOSITORY,
  type GroupDirectorshipRepository,
} from '../domain/structure.repositories.js';
import { requireEligibleTeacher } from './teacher-eligibility.js';

export interface AssignGroupDirectorInput {
  classroomId: number;
  /** `null` removes the current director. */
  employeeId: number | null;
}

/**
 * Sets or removes the director of a classroom (legacy action `assign_director`).
 * The current directorship is ended (kept as history) and a new active one is
 * started today, atomically. Fixes B5: re-assigning no longer violates the
 * `(classroom_id, is_active)` unique key.
 */
@Injectable()
export class AssignGroupDirectorUseCase implements UseCase<AssignGroupDirectorInput, void> {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(GROUP_DIRECTORSHIP_REPOSITORY) private readonly directorships: GroupDirectorshipRepository,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ classroomId, employeeId }: AssignGroupDirectorInput): Promise<void> {
    requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    if (employeeId !== null) await requireEligibleTeacher(this.staff, employeeId);

    await this.uow.runInTransaction(async () => {
      const current = await this.directorships.findActiveByClassroom(classroomId);
      if (current?.employeeId === employeeId) return;
      if (current) {
        current.end();
        await this.directorships.save(current);
      }
      if (employeeId !== null) {
        const today = schoolDateOf(this.clock.now());
        await this.directorships.save(GroupDirectorship.start(classroomId, employeeId, today));
      }
    });
  }
}
