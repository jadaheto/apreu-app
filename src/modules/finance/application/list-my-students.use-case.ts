import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { STUDENT_DIRECTORY, type BillingStudent, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { StudentAccessPolicy } from './student-access.policy.js';

/** Students linked to the signed-in student/guardian (child selector of the portal). */
@Injectable()
export class ListMyStudentsUseCase implements UseCase<AuthenticatedActor, BillingStudent[]> {
  constructor(
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<BillingStudent[]> {
    const ids = await this.access.linkedStudentIds(actor);
    const students = await Promise.all(ids.map((id) => this.students.findById(id)));
    return students
      .filter((student): student is BillingStudent => student !== null)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}
