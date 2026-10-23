import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { Calendar } from '../domain/calendar.js';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../domain/payment.repository.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { PAYMENT_QUERIES, type PaymentListItem, type PaymentQueriesPort } from './ports/payment-queries.port.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import {
  summarizeCharges,
  toChargeView,
  type ChargeView,
  type ChargesSummary,
  type StudentSummaryView,
} from './views.js';

const PAYMENT_HISTORY_LIMIT = 100;

export interface AccountStatementView {
  student: StudentSummaryView;
  summary: ChargesSummary & {
    /** Unapplied money of previous payments. */
    creditBalance: number;
    /** Balance minus credit (negative when the school owes the family). */
    netBalance: number;
  };
  charges: ChargeView[];
  payments: PaymentListItem[];
}

/**
 * Account statement of a student (legacy `finance/accounts.php`): every charge
 * with paid/pending, totals over non-cancelled charges (balance is Σ net when
 * nothing was paid, bugs B26/B27), credit balance and payment history.
 * Staff see any student; students/guardians only their own (bug S4).
 */
@Injectable()
export class GetAccountStatementUseCase implements UseCase<
  { studentId: number; actor: AuthenticatedActor },
  AccountStatementView
> {
  constructor(
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_QUERIES) private readonly paymentQueries: PaymentQueriesPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute({ studentId, actor }: { studentId: number; actor: AuthenticatedActor }): Promise<AccountStatementView> {
    await this.access.assertCanView(actor, studentId);
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundError('Estudiante', studentId);

    const today = Calendar.today(this.clock.now());
    const [charges, credits, payments] = await Promise.all([
      this.charges.findByStudent(studentId),
      this.payments.findWithCredit(studentId),
      this.paymentQueries.listByStudent(studentId, PAYMENT_HISTORY_LIMIT),
    ]);
    const summary = summarizeCharges(charges, today);
    const credit = credits.reduce((total, payment) => total.add(payment.unappliedAmount), Money.zero());
    return {
      student,
      summary: {
        ...summary,
        creditBalance: credit.amount,
        netBalance: Money.of(summary.balance).subtract(credit).amount,
      },
      charges: charges.map((charge) => toChargeView(charge, today)),
      payments,
    };
  }
}
