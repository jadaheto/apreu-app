import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Calendar } from '../domain/calendar.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { summarizeCharges, toChargeView, type ChargeView, type ChargesSummary } from './views.js';

export interface StudentChargesView {
  studentId: number;
  summary: ChargesSummary;
  charges: ChargeView[];
}

/**
 * Charges of one student with net amount, real payments and balance (portal
 * "Mis cargos", legacy `billing/mis_facturas.php` read the wrong table and
 * columns, bugs B37/B38/B44). Ownership verified (bug S5).
 */
@Injectable()
export class ListStudentChargesUseCase implements UseCase<
  { studentId: number; actor: AuthenticatedActor },
  StudentChargesView
> {
  constructor(
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute({ studentId, actor }: { studentId: number; actor: AuthenticatedActor }): Promise<StudentChargesView> {
    await this.access.assertCanView(actor, studentId);
    const today = Calendar.today(this.clock.now());
    const charges = await this.charges.findByStudent(studentId);
    return {
      studentId,
      summary: summarizeCharges(charges, today),
      charges: charges.map((charge) => toChargeView(charge, today)),
    };
  }
}
