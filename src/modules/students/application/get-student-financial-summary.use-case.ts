import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Role } from '../../../shared/domain/role.js';
import {
  STUDENT_FINANCE,
  type FinancialSummary,
  type PaymentRecord,
  type PendingCharge,
  type StudentFinancePort,
} from '../domain/student-finance.port.js';
import { todayIn } from './school-calendar.js';
import { StudentAccessPolicy } from './student-access.policy.js';

export interface GetStudentFinancialSummaryInput {
  actor: AuthenticatedActor;
  studentId: number;
}

export interface StudentFinancialView {
  summary: FinancialSummary;
  pendingCharges: PendingCharge[];
  payments: PaymentRecord[];
}

const PAYMENT_HISTORY_SIZE = 50;

/**
 * Account statement of a student (legacy `students/portal.php?section=payments`
 * and `student/pagos_realizados.php`) read from `student_charges` — not the
 * legacy `charges` table used by the old dashboard (B15) — with the balance
 * and cancelled-charge bugs fixed (B6, B7, B16, B17). Admin/finance or owners.
 */
@Injectable()
export class GetStudentFinancialSummaryUseCase implements UseCase<
  GetStudentFinancialSummaryInput,
  StudentFinancialView
> {
  constructor(
    private readonly access: StudentAccessPolicy,
    @Inject(STUDENT_FINANCE) private readonly finance: StudentFinancePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, studentId }: GetStudentFinancialSummaryInput): Promise<StudentFinancialView> {
    await this.access.load(actor, studentId, [Role.ADMIN, Role.FINANCE]);
    const today = todayIn(this.clock);
    const [summary, pendingCharges, payments] = await Promise.all([
      this.finance.summary(studentId, today),
      this.finance.pendingCharges(studentId, today),
      this.finance.payments(studentId, PAYMENT_HISTORY_SIZE),
    ]);
    return { summary, pendingCharges, payments };
  }
}
