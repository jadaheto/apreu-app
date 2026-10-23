import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Role } from '../../../shared/domain/role.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import type { Student } from '../domain/student.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentSummaryView } from './views.js';

/** Students the signed-in portal user can act on. Empty when the account is not linked. */
export interface PortalContextView {
  role: Role;
  students: StudentSummaryView[];
}

/**
 * Resolves which students a portal user sees (legacy `student/index.php`):
 * a student sees itself (`students.user_id`); a guardian sees their
 * **active** children (`guardians.user_id`, rule 19). Legacy queried
 * non-existing columns and the guardian portal never worked (B14, B16, B18);
 * the selected child is now explicit in every request instead of the session.
 */
@Injectable()
export class ResolvePortalContextUseCase implements UseCase<AuthenticatedActor, PortalContextView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<PortalContextView> {
    return {
      role: actor.role,
      students: await this.assembler.toSummaries(await this.visibleStudents(actor)),
    };
  }

  private async visibleStudents(actor: AuthenticatedActor): Promise<Student[]> {
    if (actor.role === Role.STUDENT) {
      const student = await this.students.findByUserId(actor.userId);
      return student ? [student] : [];
    }
    if (actor.role === Role.PARENT) {
      const guardian = await this.guardians.findByUserId(actor.userId);
      if (!guardian) return [];
      return (await this.students.findByGuardianId(guardian.id as number)).filter((s) => s.isActive);
    }
    return [];
  }
}
