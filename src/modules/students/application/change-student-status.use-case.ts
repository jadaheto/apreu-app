import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { StudentStatus } from '../domain/catalogs.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { STUDENT_STATUS_CHANGED, type StudentStatusChangedPayload } from './integration-events.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentView } from './views.js';

export interface ChangeStudentStatusInput {
  studentId: number;
  status: StudentStatus;
  reason?: string | null;
}

/**
 * Explicit status transition (withdrawal, graduation, suspension,
 * reactivation). Publishes `students.student-status-changed` so other
 * contexts (e.g. finance) can react.
 */
@Injectable()
export class ChangeStudentStatusUseCase implements UseCase<ChangeStudentStatusInput, StudentView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute(input: ChangeStudentStatusInput): Promise<StudentView> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError('Estudiante', input.studentId);

    const previousStatus = student.changeStatus(input.status);
    await this.students.save(student);
    await this.events.publish({
      name: STUDENT_STATUS_CHANGED,
      occurredAt: this.clock.now(),
      payload: {
        studentId: student.id as number,
        code: student.code.toString(),
        previousStatus,
        status: student.status,
        reason: input.reason?.trim() || null,
      } satisfies StudentStatusChangedPayload,
    });
    return this.assembler.toView(student);
  }
}
