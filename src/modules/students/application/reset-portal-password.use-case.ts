import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { PortalAccountProvisioner, type AccountHolder } from './portal-account-provisioner.js';
import { USER_ACCOUNTS, type UserAccountPort } from './ports/user-account.port.js';

export interface ResetPortalPasswordInput {
  studentId: number;
  holder: AccountHolder;
}

export interface ResetPortalPasswordOutput {
  email: string;
  temporaryPassword: string;
}

/**
 * Generates a new random temporary password for the portal account of a
 * student or of their guardian. Returned once in the response body.
 */
@Injectable()
export class ResetPortalPasswordUseCase implements UseCase<ResetPortalPasswordInput, ResetPortalPasswordOutput> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    @Inject(USER_ACCOUNTS) private readonly users: UserAccountPort,
    private readonly provisioner: PortalAccountProvisioner,
  ) {}

  async execute({ studentId, holder }: ResetPortalPasswordInput): Promise<ResetPortalPasswordOutput> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundError('Estudiante', studentId);

    const userId = holder === 'student' ? student.userId : await this.guardianUserId(student.guardianId);
    const account = userId !== null ? await this.users.findById(userId) : null;
    if (!account) {
      throw new BusinessRuleViolationError(
        'La cuenta del portal no existe; créela primero.',
        'PORTAL_ACCOUNT_MISSING',
        {
          holder,
        },
      );
    }
    return {
      email: account.email,
      temporaryPassword: await this.provisioner.resetPassword(account.id),
    };
  }

  private async guardianUserId(guardianId: number | null): Promise<number | null> {
    if (guardianId === null) return null;
    return (await this.guardians.findById(guardianId))?.userId ?? null;
  }
}
