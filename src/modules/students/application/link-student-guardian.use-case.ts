import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentView } from './views.js';

export interface LinkStudentGuardianInput {
  studentId: number;
  /** `null` unlinks the current guardian. */
  guardianId: number | null;
}

/** Sets (or removes) the legal guardian of a student (one guardian per student, `students.guardian_id`). */
@Injectable()
export class LinkStudentGuardianUseCase implements UseCase<LinkStudentGuardianInput, StudentView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute({ studentId, guardianId }: LinkStudentGuardianInput): Promise<StudentView> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundError('Estudiante', studentId);
    if (guardianId === null) {
      student.unlinkGuardian();
    } else {
      if (!(await this.guardians.findById(guardianId))) throw new NotFoundError('Acudiente', guardianId);
      student.linkGuardian(guardianId);
    }
    await this.students.save(student);
    return this.assembler.toView(student);
  }
}
