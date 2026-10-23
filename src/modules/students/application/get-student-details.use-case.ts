import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentView } from './views.js';

export interface GetStudentDetailsInput {
  actor: AuthenticatedActor;
  studentId: number;
}

/**
 * Read-only record of a student for the portal (legacy `student/perfil.php`)
 * with ownership verification (fixes IDOR S3).
 */
@Injectable()
export class GetStudentDetailsUseCase implements UseCase<GetStudentDetailsInput, StudentView> {
  constructor(
    private readonly access: StudentAccessPolicy,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute({ actor, studentId }: GetStudentDetailsInput): Promise<StudentView> {
    return this.assembler.toView(await this.access.load(actor, studentId));
  }
}
