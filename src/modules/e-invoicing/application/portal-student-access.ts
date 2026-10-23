import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { ForbiddenError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { PORTAL_STUDENT_LINKS, type PortalStudentLinksPort } from '../domain/portal-student-links.port.js';

/**
 * Ownership rule of the e-invoicing portal (same as `/api/finance/portal` and
 * `/api/portal/students/{id}`): a student sees only itself and a guardian only
 * the students in their care; any other role is rejected. Returns the payments
 * of the student, which identify their electronic documents.
 */
@Injectable()
export class PortalStudentAccess {
  constructor(@Inject(PORTAL_STUDENT_LINKS) private readonly links: PortalStudentLinksPort) {}

  async paymentIdsVisibleTo(actor: AuthenticatedActor, studentId: number): Promise<number[]> {
    const isPortalUser = actor.role === Role.STUDENT || actor.role === Role.PARENT;
    const linked = isPortalUser
      ? await this.links.studentIdsLinkedTo({ userId: actor.userId, email: actor.email, role: actor.role })
      : [];
    if (!linked.includes(studentId)) {
      throw new ForbiddenError('No tiene acceso a las facturas electrónicas de este estudiante.');
    }
    return this.links.paymentIdsOfStudent(studentId);
  }
}
