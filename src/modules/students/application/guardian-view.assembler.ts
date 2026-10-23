import { Inject, Injectable } from '@nestjs/common';
import type { Guardian } from '../domain/guardian.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { toGuardianView, type GuardianView } from './views.js';

/** Guardian plus the students (siblings) linked to it. */
export interface GuardianDetailView extends GuardianView {
  students: { id: number; code: string; fullName: string; status: string }[];
}

/** Builds {@link GuardianDetailView}s. */
@Injectable()
export class GuardianViewAssembler {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository) {}

  async toView(guardian: Guardian): Promise<GuardianDetailView> {
    const children = guardian.id === null ? [] : await this.students.findByGuardianId(guardian.id);
    return {
      ...toGuardianView(guardian),
      students: children.map((s) => ({
        id: s.id as number,
        code: s.code.toString(),
        fullName: s.fullName,
        status: s.status,
      })),
    };
  }
}
