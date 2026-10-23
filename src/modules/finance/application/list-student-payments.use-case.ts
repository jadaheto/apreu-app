import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { PAYMENT_QUERIES, type PaymentListItem, type PaymentQueriesPort } from './ports/payment-queries.port.js';
import { StudentAccessPolicy } from './student-access.policy.js';

const MAX_PAYMENTS = 50;

/**
 * Payments of one student, most recent first, with every concept paid
 * (portal "Mis pagos"; legacy `finance/mis_pagos.php` had an IDOR and showed
 * one arbitrary concept, bugs S5/B45; `student/pagos_realizados.php` never
 * worked, bug B41). Ownership verified.
 */
@Injectable()
export class ListStudentPaymentsUseCase implements UseCase<
  { studentId: number; actor: AuthenticatedActor },
  PaymentListItem[]
> {
  constructor(
    @Inject(PAYMENT_QUERIES) private readonly queries: PaymentQueriesPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute({ studentId, actor }: { studentId: number; actor: AuthenticatedActor }): Promise<PaymentListItem[]> {
    await this.access.assertCanView(actor, studentId);
    return this.queries.listByStudent(studentId, MAX_PAYMENTS);
  }
}
