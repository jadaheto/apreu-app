import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../../common/domain/student-directory.port.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';

/**
 * Deletes an empty classroom. The legacy delete cascaded to assignments and
 * unlinked every student (§2.1); now it requires no active students and no
 * teaching assignments.
 */
@Injectable()
export class DeleteClassroomUseCase implements UseCase<number, void> {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
  ) {}

  async execute(classroomId: number): Promise<void> {
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    const [counts, assignments] = await Promise.all([
      this.students.countActiveByClassroom([classroomId]),
      this.assignments.countByClassroom(classroomId),
    ]);
    const students = counts.get(classroomId) ?? 0;
    if (students > 0 || assignments > 0) {
      throw new ConflictError(
        `El salón "${classroom.name}" tiene ${students} estudiante(s) activo(s) y ${assignments} asignación(es) docente(s).`,
        { students, assignments },
      );
    }
    await this.classrooms.delete(classroomId);
  }
}
