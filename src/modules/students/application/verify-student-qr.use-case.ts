import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import { StudentQrPayload } from '../domain/student-qr-payload.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { QR_SIGNER, type QrSignerPort } from './ports/qr-signer.port.js';
import { academicYearOf } from './school-calendar.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentSummaryView } from './views.js';

export interface VerifyStudentQrInput {
  actor: AuthenticatedActor;
  rawQr: string;
}

/**
 * Resolves the student of a scanned ID card QR. The QR must be signed by this
 * server, belong to the actor's school and to the academic year in force, and
 * the student must be active. Replaces the forgeable prefix match of
 * `api/register_attendance.php` (security S9/S13).
 */
@Injectable()
export class VerifyStudentQrUseCase implements UseCase<VerifyStudentQrInput, StudentSummaryView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    @Inject(QR_SIGNER) private readonly signer: QrSignerPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute({ actor, rawQr }: VerifyStudentQrInput): Promise<StudentSummaryView> {
    const payload = StudentQrPayload.parse(rawQr);
    if (payload.tenant !== actor.tenant || !this.signer.verify(payload.message, payload.signature as string)) {
      throw new BusinessRuleViolationError('El código QR no es un carnet válido de este colegio.', 'INVALID_QR');
    }
    const academicYear = academicYearOf(await this.settings.load(), this.clock);
    if (payload.academicYear !== academicYear) {
      throw new BusinessRuleViolationError(`El carnet corresponde al año ${payload.academicYear}.`, 'QR_EXPIRED', {
        academicYear,
      });
    }
    const student = await this.students.findById(payload.studentId);
    if (!student?.isActive) {
      throw new BusinessRuleViolationError('El estudiante del carnet no está activo.', 'STUDENT_NOT_ACTIVE');
    }
    const [view] = await this.assembler.toSummaries([student]);
    return view;
  }
}
