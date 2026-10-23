import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { Calendar } from '../domain/calendar.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { toChargeView, type ChargeView, type StudentSummaryView } from './views.js';

/** Data of the informative "factura de cobro" (legacy `billing/print_charge.php`). */
export interface ChargeDocumentView {
  documentNumber: string;
  issueDate: string | null;
  schoolName: string;
  schoolNit: string;
  conceptName: string;
  conceptCategory: string;
  student: StudentSummaryView;
  charge: ChargeView;
  /** True when nothing is pending (stamp "PAGADO"). */
  isPaid: boolean;
}

/**
 * Printable charge with taxes, real payments and balance (legacy ignored
 * `payment_applications` and taxes, bug B38; issue date was the print date,
 * bug B40). Students/guardians only see their own charges (bug S6).
 */
@Injectable()
export class GetChargeDocumentUseCase implements UseCase<
  { chargeId: number; actor: AuthenticatedActor },
  ChargeDocumentView
> {
  constructor(
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute({ chargeId, actor }: { chargeId: number; actor: AuthenticatedActor }): Promise<ChargeDocumentView> {
    const charge = await this.charges.findById(chargeId);
    if (!charge) throw new NotFoundError('Cargo', chargeId);
    await this.access.assertCanView(actor, charge.studentId);

    const [student, concept, settings] = await Promise.all([
      this.students.findById(charge.studentId),
      this.concepts.findById(charge.conceptId),
      this.settings.load(),
    ]);
    if (!student) throw new NotFoundError('Estudiante', charge.studentId);
    return {
      documentNumber: String(charge.id).padStart(6, '0'),
      issueDate: charge.createdAt ? Calendar.today(charge.createdAt) : null,
      schoolName: settings.schoolName,
      schoolNit: settings.schoolNit,
      conceptName: concept?.name ?? charge.description,
      conceptCategory: concept?.category ?? 'otro',
      student,
      charge: toChargeView(charge, Calendar.today(this.clock.now())),
      isPaid: charge.status === 'paid',
    };
  }
}
