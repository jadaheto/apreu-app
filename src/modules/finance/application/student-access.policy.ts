import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { ForbiddenError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { STUDENT_LINKS, type StudentLinksPort } from '../domain/student-links.port.js';

/** Roles that see the finances of every student. */
export const FINANCE_STAFF_ROLES: readonly Role[] = [Role.SUPERADMIN, Role.ADMIN, Role.FINANCE];

/**
 * Ownership check for student finance data (fixes IDOR bugs S4–S6 of the
 * legacy `accounts.php`, `mis_pagos.php`, `print_receipt.php`,
 * `print_charge.php`): staff see everyone, students and guardians only the
 * students linked to them, every other role nothing.
 */
@Injectable()
export class StudentAccessPolicy {
  constructor(@Inject(STUDENT_LINKS) private readonly links: StudentLinksPort) {}

  async assertCanView(actor: AuthenticatedActor, studentId: number): Promise<void> {
    if (FINANCE_STAFF_ROLES.includes(actor.role)) return;
    if ((await this.linkedStudentIds(actor)).includes(studentId)) return;
    throw new ForbiddenError('No tiene acceso a la información financiera de este estudiante.');
  }

  /** Students linked to a student/guardian user (empty for other roles). */
  async linkedStudentIds(actor: AuthenticatedActor): Promise<number[]> {
    if (actor.role !== Role.STUDENT && actor.role !== Role.PARENT) return [];
    return this.links.studentIdsLinkedTo({ userId: actor.userId, email: actor.email, role: actor.role });
  }
}
