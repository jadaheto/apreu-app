import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { Calendar } from '../domain/calendar.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { ChargeBatchPlanner, type ChargeRequest } from './charge-batch-planner.js';
import { toChargeView, type ChargeView } from './views.js';

export interface CreateIndividualChargeInput extends ChargeRequest {
  studentId: number;
  description?: string | null;
  /** The same concept may be billed twice in a month only when explicitly requested (e.g. two certificates). */
  allowDuplicate?: boolean;
}

/**
 * Creates a single charge for one student, with optional custom description,
 * amount and due date (legacy individual form had neither due date nor
 * duplicate check, bug B14).
 */
@Injectable()
export class CreateIndividualChargeUseCase implements UseCase<CreateIndividualChargeInput, ChargeView> {
  constructor(
    private readonly planner: ChargeBatchPlanner,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: CreateIndividualChargeInput): Promise<ChargeView> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError('Estudiante', input.studentId);

    if (!input.allowDuplicate) {
      const period = BillingPeriod.create(input.period);
      const already = await this.charges.studentsAlreadyCharged(input.conceptId, period, [student.id]);
      if (already.has(student.id)) {
        throw new ConflictError('El estudiante ya tiene un cargo de este concepto en el mes indicado.', {
          studentId: student.id,
          conceptId: input.conceptId,
          period: period.toString(),
        });
      }
    }

    const charge = await this.planner.planSingle({ ...input, student });
    await this.charges.save(charge);
    return toChargeView(charge, Calendar.today(this.clock.now()));
  }
}
