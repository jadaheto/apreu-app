import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { Calendar } from '../domain/calendar.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import { Payment } from '../domain/payment.js';
import { PaymentAllocator, type Allocation } from '../domain/payment-allocator.js';
import { isPaymentMethod } from '../domain/payment-method.js';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../domain/payment.repository.js';
import { ReceiptNumber } from '../domain/receipt-number.js';
import { RECEIPT_SEQUENCE, type ReceiptSequencePort } from '../domain/receipt-sequence.port.js';
import type { ChargeStatus, StudentCharge } from '../domain/student-charge.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { PAYMENT_REGISTERED, type PaymentRegisteredPayload } from './integration-events.js';

export interface RegisterPaymentInput {
  studentId: number;
  amount: number;
  method: string;
  /** `YYYY-MM-DD`; defaults to today and cannot be in the future. */
  paymentDate?: string;
  notes?: string | null;
  reference?: string | null;
  /** Charges to pay; when omitted every open charge of the student is eligible. */
  chargeIds?: number[];
  actor: AuthenticatedActor;
}

export interface AppliedChargeView {
  chargeId: number;
  conceptId: number;
  conceptName: string;
  description: string;
  amount: number;
  chargeStatus: ChargeStatus;
  chargePending: number;
}

export interface RegisteredPaymentView {
  paymentId: number;
  receiptNumber: string;
  studentId: number;
  amount: number;
  appliedAmount: number;
  /** Part of this payment left as credit balance. */
  unappliedAmount: number;
  /** Total credit balance of the student after the payment. */
  creditBalance: number;
  paidAt: Date;
  applications: AppliedChargeView[];
}

/**
 * Registers a payment at the cashier (legacy `finance/cashier.php`), atomically
 * (rule RN-16):
 *
 * 1. The method must be enabled in the settings (bug B7) and the date cannot be future.
 * 2. The receipt number `{prefix}-{YYYY}-{NNNNNN}` comes from a locked counter
 *    inside the transaction (bugs B1–B3).
 * 3. The money is applied to the selected (or all) open charges of the student,
 *    oldest first, locking them (rules RN-13/RN-14, bugs B5/B6); asking for a
 *    charge that is not open for this student is an error.
 * 4. Any excess is kept as explicit credit balance of the student instead of
 *    being lost (bug B4) and can be applied later.
 * 5. `finance.payment-registered` is published after commit; certificates are
 *    issued by the students context reacting to it (bug B8).
 */
@Injectable()
export class RegisterPaymentUseCase implements UseCase<RegisterPaymentInput, RegisteredPaymentView> {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(RECEIPT_SEQUENCE) private readonly receipts: ReceiptSequencePort,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: RegisterPaymentInput): Promise<RegisteredPaymentView> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError('Estudiante', input.studentId);

    const settings = await this.settings.load();
    const method = input.method;
    if (!isPaymentMethod(method) || !settings.enabledPaymentMethods.includes(method)) {
      throw new BusinessRuleViolationError(
        `El método de pago "${method}" no está habilitado.`,
        'PAYMENT_METHOD_NOT_ENABLED',
      );
    }

    const now = this.clock.now();
    const today = Calendar.today(now);
    const paymentDate = input.paymentDate ? Calendar.assertDate(input.paymentDate, 'fecha de pago') : today;
    if (paymentDate > today) {
      throw new BusinessRuleViolationError('La fecha de pago no puede ser futura.', 'PAYMENT_DATE_IN_FUTURE');
    }

    const { payment, allocations } = await this.uow.runInTransaction(async () => {
      const eligible = this.select(
        await this.charges.findOpenByStudent(student.id, { forUpdate: true }),
        input.chargeIds,
      );
      const year = Calendar.year(paymentDate);
      const sequence = await this.receipts.next(settings.receiptPrefix, year);
      const registered = Payment.register({
        studentId: student.id,
        receiptNumber: ReceiptNumber.compose(settings.receiptPrefix, year, sequence),
        amount: Money.of(input.amount),
        method,
        paidAt: paymentDate === today ? now : Calendar.startOfDay(paymentDate),
        cashierId: input.actor.userId,
        notes: input.notes,
        reference: input.reference,
      });
      const applied = PaymentAllocator.settle(registered, eligible);
      await this.payments.save(registered);
      await this.charges.saveMany(applied.map((allocation) => allocation.charge));
      return { payment: registered, allocations: applied };
    });

    const applications = await this.describe(allocations);
    await this.publish(payment, applications);
    const credit = await this.payments.findWithCredit(student.id);
    return {
      paymentId: payment.id as number,
      receiptNumber: payment.receiptNumber,
      studentId: payment.studentId,
      amount: payment.amount.amount,
      appliedAmount: payment.appliedAmount.amount,
      unappliedAmount: payment.unappliedAmount.amount,
      creditBalance: credit.reduce((total, item) => total.add(item.unappliedAmount), Money.zero()).amount,
      paidAt: payment.paidAt,
      applications: applications.map(({ category: _category, ...view }) => view),
    };
  }

  private select(open: StudentCharge[], chargeIds?: number[]): StudentCharge[] {
    if (!chargeIds?.length) return open;
    const requested = new Set(chargeIds);
    const selected = open.filter((charge) => requested.has(charge.id as number));
    if (selected.length !== requested.size) {
      const missing = [...requested].filter((id) => !selected.some((charge) => charge.id === id));
      throw new BusinessRuleViolationError(
        'Algunos cargos seleccionados no están pendientes o no pertenecen al estudiante.',
        'CHARGE_NOT_PAYABLE',
        { chargeIds: missing },
      );
    }
    return selected;
  }

  private async describe(allocations: Allocation[]): Promise<(AppliedChargeView & { category: string })[]> {
    const concepts = await this.concepts.findByIds([...new Set(allocations.map(({ charge }) => charge.conceptId))]);
    return allocations.map(({ charge, amount }) => {
      const concept = concepts.find((item) => item.id === charge.conceptId);
      return {
        chargeId: charge.id as number,
        conceptId: charge.conceptId,
        conceptName: concept?.name ?? charge.description,
        category: concept?.category ?? 'otro',
        description: charge.description,
        amount: amount.amount,
        chargeStatus: charge.status,
        chargePending: charge.pendingAmount.amount,
      };
    });
  }

  private async publish(payment: Payment, applications: (AppliedChargeView & { category: string })[]): Promise<void> {
    const payload: PaymentRegisteredPayload = {
      paymentId: payment.id as number,
      receiptNumber: payment.receiptNumber,
      studentId: payment.studentId,
      totalAmount: payment.amount.amount,
      method: payment.method,
      paidAt: payment.paidAt.toISOString(),
      appliedCharges: applications.map((application) => ({
        studentChargeId: application.chargeId,
        conceptId: application.conceptId,
        conceptName: application.conceptName,
        conceptCategory: application.category,
        amount: application.amount,
      })),
    };
    await this.events.publish({ name: PAYMENT_REGISTERED, occurredAt: this.clock.now(), payload: { ...payload } });
  }
}
