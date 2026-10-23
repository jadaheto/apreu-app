import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { PortalAccountProvisioner, type ProvisionedAccount } from './portal-account-provisioner.js';

/**
 * Creates or links the missing portal accounts of an already enrolled
 * student and their guardian (students migrated from the legacy system had
 * no `user_id`). Accounts already linked are left untouched.
 */
@Injectable()
export class ProvisionPortalAccountsUseCase implements UseCase<number, ProvisionedAccount[]> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    private readonly provisioner: PortalAccountProvisioner,
  ) {}

  execute(studentId: number): Promise<ProvisionedAccount[]> {
    return this.unitOfWork.runInTransaction(async () => {
      const student = await this.students.findById(studentId);
      if (!student) throw new NotFoundError('Estudiante', studentId);

      const accounts = [await this.provisioner.forStudent(student)];
      await this.students.save(student);

      const guardian = student.guardianId !== null ? await this.guardians.findById(student.guardianId) : null;
      if (guardian) {
        accounts.push(await this.provisioner.forGuardian(guardian));
        await this.guardians.save(guardian);
      }
      return accounts;
    });
  }
}
