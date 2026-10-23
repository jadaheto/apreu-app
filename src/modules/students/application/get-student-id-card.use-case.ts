import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Role } from '../../../shared/domain/role.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import { StudentQrPayload } from '../domain/student-qr-payload.js';
import { QR_SIGNER, type QrSignerPort } from './ports/qr-signer.port.js';
import { academicYearOf } from './school-calendar.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { PlacementView } from './views.js';

export interface GetStudentIdCardInput {
  actor: AuthenticatedActor;
  studentId: number;
}

/** Data of the printable student ID card (analysis 03 §3.6 rule 27). */
export interface StudentIdCardView {
  institution: {
    name: string;
    nit: string;
    city: string;
    logo: string | null;
    logoSize: number;
  };
  academicYear: number;
  student: {
    id: number;
    fullName: string;
    initials: string;
    code: string;
    documentType: string;
    documentNumber: string | null;
    bloodType: string | null;
    status: string;
    photoAvailable: boolean;
    placement: PlacementView | null;
  };
  guardian: { fullName: string; mobile: string | null } | null;
  /** Signed QR text `APREU1|tenant|studentId|year|signature` to render client-side. */
  qr: string;
}

/** Logo height on the ID card is clamped to 28-40 px (legacy `students/portal.php`). */
const clampLogo = (size: number): number => Math.min(40, Math.max(28, size));

/**
 * Digital ID card with a signed QR (legacy `students/portal.php?section=carnet`).
 * Accessible to admins and to the student/guardian owner (fixes IDOR S2).
 * The year printed is the academic year, not `date('Y')` (B21).
 */
@Injectable()
export class GetStudentIdCardUseCase implements UseCase<GetStudentIdCardInput, StudentIdCardView> {
  constructor(
    private readonly access: StudentAccessPolicy,
    private readonly assembler: StudentViewAssembler,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    @Inject(QR_SIGNER) private readonly signer: QrSignerPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, studentId }: GetStudentIdCardInput): Promise<StudentIdCardView> {
    const student = await this.access.load(actor, studentId, [Role.ADMIN]);
    const [view, institution] = await Promise.all([this.assembler.toView(student), this.settings.load()]);
    const academicYear = academicYearOf(institution, this.clock);
    const payload = StudentQrPayload.for(actor.tenant, studentId, academicYear);

    return {
      institution: {
        name: institution.schoolName,
        nit: institution.nit,
        city: institution.city,
        logo: institution.logo,
        logoSize: clampLogo(institution.logoSize),
      },
      academicYear,
      student: {
        id: view.id,
        fullName: view.fullName,
        initials: view.initials,
        code: view.code,
        documentType: view.documentType,
        documentNumber: view.documentNumber,
        bloodType: view.bloodType,
        status: view.status,
        photoAvailable: view.photoAvailable,
        placement: view.placement,
      },
      guardian: view.guardianDetails
        ? {
            fullName: view.guardianDetails.fullName,
            mobile: view.guardianDetails.mobile,
          }
        : null,
      qr: payload.withSignature(this.signer.sign(payload.message)).toString(),
    };
  }
}
