import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Guardian, type GuardianDetails } from '../domain/guardian.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import { Student, type StudentDetails } from '../domain/student.js';
import { StudentCode } from '../domain/student-code.js';
import { STUDENT_CODE_SEQUENCE, type StudentCodeSequencePort } from '../domain/student-code-sequence.port.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { ClassroomPlacement } from './classroom-placement.js';
import { STUDENT_ENROLLED, type StudentEnrolledPayload } from './integration-events.js';
import { PortalAccountProvisioner, type ProvisionedAccount } from './portal-account-provisioner.js';
import { academicYearOf, todayIn } from './school-calendar.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentView } from './views.js';

/** Either an existing guardian (by id) or the data of the guardian to find/create by document. */
export type GuardianSelection = { guardianId: number } | { details: GuardianDetails };

export interface EnrollStudentInput {
  details: StudentDetails;
  classroomId?: number | null;
  /** Defaults to today. */
  enrollmentDate?: string;
  guardian?: GuardianSelection | null;
  /** Creates/links the student and guardian portal users (default `true`). */
  createPortalAccounts?: boolean;
}

export interface EnrollStudentOutput {
  student: StudentView;
  /** True when an existing guardian (sibling) was reused instead of created. */
  guardianReused: boolean;
  /** Generated credentials, shown once to the office (never placed in a URL). */
  accounts: ProvisionedAccount[];
}

/**
 * Enrolls a student (legacy `students/create.php`, new-student branch) in a
 * single transaction:
 *
 * 1. Rejects duplicated documents (same type and number).
 * 2. Validates that the classroom belongs to the academic year in force.
 * 3. Reuses the guardian with the same document number instead of inserting
 *    a duplicate (bug B10, siblings) or creates it.
 * 4. Assigns the code `AL{year}{sequence}` from a transactional counter (B11).
 * 5. Creates/links the portal users with random passwords and fills
 *    `students.user_id` / `guardians.user_id` (B12, B14, S5).
 *
 * Publishes `students.student-enrolled` after the transaction commits.
 */
@Injectable()
export class EnrollStudentUseCase implements UseCase<EnrollStudentInput, EnrollStudentOutput> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
    @Inject(STUDENT_CODE_SEQUENCE)
    private readonly sequence: StudentCodeSequencePort,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly placement: ClassroomPlacement,
    private readonly provisioner: PortalAccountProvisioner,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute(input: EnrollStudentInput): Promise<EnrollStudentOutput> {
    const today = todayIn(this.clock);
    const academicYear = academicYearOf(await this.settings.load(), this.clock);
    const classroom = await this.placement.resolve(input.classroomId ?? null, academicYear);

    const result = await this.unitOfWork.runInTransaction(async () => {
      const { guardian, reused } = await this.resolveGuardian(input.guardian ?? null);
      const student = Student.enroll({
        code: await this.nextCode(academicYear),
        details: input.details,
        classroomId: classroom?.id ?? null,
        academicYear,
        enrollmentDate: input.enrollmentDate ?? today,
        guardianId: guardian?.id ?? null,
        today,
      });
      await this.assertUniqueDocument(student);
      await this.students.save(student);

      const accounts: ProvisionedAccount[] = [];
      if (input.createPortalAccounts ?? true) {
        accounts.push(await this.provisioner.forStudent(student));
        await this.students.save(student);
        if (guardian) {
          accounts.push(await this.provisioner.forGuardian(guardian));
          await this.guardians.save(guardian);
        }
      }
      return { student, guardian, reused, accounts };
    });

    const { student, guardian } = result;
    await this.events.publish({
      name: STUDENT_ENROLLED,
      occurredAt: this.clock.now(),
      payload: {
        studentId: student.id as number,
        code: student.code.toString(),
        fullName: student.fullName,
        gradeId: classroom?.gradeId ?? null,
        classroomId: classroom?.id ?? null,
        documentNumber: student.documentNumber as string,
        guardianEmail: guardian?.email ?? null,
      } satisfies StudentEnrolledPayload,
    });

    return {
      student: await this.assembler.toView(student),
      guardianReused: result.reused,
      accounts: result.accounts,
    };
  }

  private async resolveGuardian(
    selection: GuardianSelection | null,
  ): Promise<{ guardian: Guardian | null; reused: boolean }> {
    if (!selection) return { guardian: null, reused: false };
    if ('guardianId' in selection) {
      const guardian = await this.guardians.findById(selection.guardianId);
      if (!guardian) throw new NotFoundError('Acudiente', selection.guardianId);
      return { guardian, reused: true };
    }
    const candidate = Guardian.create(selection.details);
    const existing = await this.guardians.findByDocumentNumber(candidate.documentNumber);
    if (existing) return { guardian: existing, reused: true };
    await this.guardians.save(candidate);
    return { guardian: candidate, reused: false };
  }

  /** Next free code; skips numbers already taken by legacy/manual data. */
  private async nextCode(year: number): Promise<StudentCode> {
    let code = StudentCode.compose(year, await this.sequence.next(year));
    while (await this.students.existsByCode(code.toString())) {
      code = StudentCode.compose(year, await this.sequence.next(year));
    }
    return code;
  }

  private async assertUniqueDocument(student: Student): Promise<void> {
    const existing = await this.students.findByDocument(student.documentType, student.documentNumber as string);
    if (existing) {
      throw new ConflictError(
        `Ya existe un estudiante con el documento ${student.documentType} ${student.documentNumber}.`,
        {
          studentId: existing.id,
        },
      );
    }
  }
}
