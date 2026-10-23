import { Inject, Injectable } from '@nestjs/common';
import { CLASSROOM_DIRECTORY, type ClassroomDirectoryPort } from '../domain/classroom-directory.port.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import type { Student } from '../domain/student.js';
import { toStudentSummaryView, toStudentView, type StudentSummaryView, type StudentView } from './views.js';

const distinct = (ids: (number | null)[]): number[] => [...new Set(ids.filter((id): id is number => id !== null))];

/**
 * Builds student read models enriched with classroom/grade (academic
 * context) and guardian data, batching lookups to avoid N+1 queries.
 */
@Injectable()
export class StudentViewAssembler {
  constructor(
    @Inject(CLASSROOM_DIRECTORY)
    private readonly classrooms: ClassroomDirectoryPort,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
  ) {}

  async toView(student: Student): Promise<StudentView> {
    const [classroom, guardian] = await Promise.all([
      student.classroomId !== null ? this.classrooms.findById(student.classroomId) : null,
      student.guardianId !== null ? this.guardians.findById(student.guardianId) : null,
    ]);
    return toStudentView(student, classroom, guardian);
  }

  async toSummaries(students: Student[]): Promise<StudentSummaryView[]> {
    const [classrooms, guardians] = await Promise.all([
      this.classrooms.findByIds(distinct(students.map((s) => s.classroomId))),
      this.guardians.findByIds(distinct(students.map((s) => s.guardianId))),
    ]);
    const classroomById = new Map(classrooms.map((c) => [c.id, c]));
    const guardianById = new Map(guardians.map((g) => [g.id as number, g]));
    return students.map((student) =>
      toStudentSummaryView(
        student,
        student.classroomId !== null ? classroomById.get(student.classroomId) : null,
        student.guardianId !== null ? guardianById.get(student.guardianId) : null,
      ),
    );
  }
}
