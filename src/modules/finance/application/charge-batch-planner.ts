import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import type { BillingConcept } from '../domain/billing-concept.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { Calendar } from '../domain/calendar.js';
import { ChargeAmountCalculator } from '../domain/charge-amount-calculator.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import { StudentCharge } from '../domain/student-charge.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { STUDENT_DIRECTORY, type BillingStudent, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { TUITION_SCHEDULE_REPOSITORY, type TuitionScheduleRepository } from '../domain/tuition-schedule.repository.js';

/** Parameters shared by the charge generation use cases. */
export interface ChargeRequest {
  conceptId: number;
  /** Billed month `YYYY-MM`. */
  period: string;
  /** Defaults to the last day of the period (rule RN-06). */
  dueDate?: string;
  customAmount?: number | null;
  /** Applies the student's scholarship percentage as discount. */
  applyScholarship?: boolean;
  createdBy: number | null;
}

export interface BatchRequest extends ChargeRequest {
  /** Restricts the batch to the active students of a grade. */
  gradeId?: number;
}

/** Charges a batch would create, plus what was skipped as duplicate. */
export interface ChargeBatchPlan {
  concept: BillingConcept;
  period: BillingPeriod;
  dueDate: string;
  studentsCount: number;
  alreadyCharged: number;
  charges: StudentCharge[];
}

/** Outcome of a batch, shared by preview and generation. */
export interface ChargeBatchSummary {
  conceptId: number;
  conceptName: string;
  period: string;
  dueDate: string;
  studentsCount: number;
  alreadyCharged: number;
  chargesCount: number;
  totalNet: number;
  /** Distinct net amounts and how many charges have each one. */
  amounts: { netAmount: number; count: number }[];
}

/**
 * Builds new charges for students (legacy `finance/student_billing.php`):
 * resolves the concept, period, due date, academic year and the amounts with
 * {@link ChargeAmountCalculator} (tuition per grade is now used, bug B17), and
 * skips students already charged for the concept in the period (rule RN-07,
 * keyed by billed period instead of due-date month, bug B12).
 */
@Injectable()
export class ChargeBatchPlanner {
  constructor(
    @Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository,
    @Inject(TUITION_SCHEDULE_REPOSITORY) private readonly tuition: TuitionScheduleRepository,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
  ) {}

  async planBatch(request: BatchRequest): Promise<ChargeBatchPlan> {
    const students = await this.students.findActive({ gradeId: request.gradeId });
    if (students.length === 0) {
      throw new BusinessRuleViolationError('No hay estudiantes activos para facturar.', 'NO_STUDENTS_TO_BILL');
    }
    const concept = await this.activeConcept(request.conceptId);
    const period = BillingPeriod.create(request.period);
    const already = await this.charges.studentsAlreadyCharged(
      request.conceptId,
      period,
      students.map((student) => student.id),
    );
    const pending = students.filter((student) => !already.has(student.id));
    return {
      concept,
      period,
      dueDate: this.dueDate(request, period),
      studentsCount: students.length,
      alreadyCharged: students.length - pending.length,
      charges: await this.build(concept, period, request, pending),
    };
  }

  /** Builds one charge for a student (individual charge). */
  async planSingle(
    request: ChargeRequest & { student: BillingStudent; description?: string | null },
  ): Promise<StudentCharge> {
    const concept = await this.activeConcept(request.conceptId);
    const period = BillingPeriod.create(request.period);
    const [charge] = await this.build(concept, period, request, [request.student], request.description);
    return charge;
  }

  static summarize(plan: ChargeBatchPlan): ChargeBatchSummary {
    const groups = new Map<number, number>();
    let total = Money.zero();
    for (const charge of plan.charges) {
      total = total.add(charge.amounts.net);
      groups.set(charge.amounts.net.amount, (groups.get(charge.amounts.net.amount) ?? 0) + 1);
    }
    return {
      conceptId: plan.concept.id as number,
      conceptName: plan.concept.name,
      period: plan.period.toString(),
      dueDate: plan.dueDate,
      studentsCount: plan.studentsCount,
      alreadyCharged: plan.alreadyCharged,
      chargesCount: plan.charges.length,
      totalNet: total.amount,
      amounts: [...groups].map(([netAmount, count]) => ({ netAmount, count })),
    };
  }

  private async activeConcept(id: number): Promise<BillingConcept> {
    const concept = await this.concepts.findById(id);
    if (!concept) throw new NotFoundError('Concepto de cobro', id);
    if (!concept.isActive) {
      throw new BusinessRuleViolationError('El concepto de cobro está inactivo.', 'CONCEPT_INACTIVE');
    }
    return concept;
  }

  private dueDate(request: ChargeRequest, period: BillingPeriod): string {
    return request.dueDate ? Calendar.assertDate(request.dueDate, 'vencimiento') : period.lastDay();
  }

  private async build(
    concept: BillingConcept,
    period: BillingPeriod,
    request: ChargeRequest,
    students: BillingStudent[],
    customDescription?: string | null,
  ): Promise<StudentCharge[]> {
    const { academicYear } = await this.settings.load();
    const tuition = await this.tuition.findByYear(academicYear);
    const dueDate = this.dueDate(request, period);
    return students.map((student) =>
      StudentCharge.create({
        studentId: student.id,
        conceptId: concept.id as number,
        description: customDescription?.trim() || `${concept.name} — ${period.label()}`,
        amounts: ChargeAmountCalculator.compute({
          concept,
          gradeId: student.gradeId,
          tuition,
          customAmount: request.customAmount,
          scholarshipPct: request.applyScholarship ? student.scholarshipPct : 0,
        }),
        period,
        dueDate,
        academicYear,
        createdBy: request.createdBy,
      }),
    );
  }
}
