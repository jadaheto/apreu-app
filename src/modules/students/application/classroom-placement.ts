import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  CLASSROOM_DIRECTORY,
  type ClassroomDirectoryPort,
  type ClassroomInfo,
} from '../domain/classroom-directory.port.js';

/**
 * Validates classroom assignments: only classrooms of the academic year in
 * force can be chosen (analysis 03 rule 7, legacy `students/create.php:19`).
 */
@Injectable()
export class ClassroomPlacement {
  constructor(
    @Inject(CLASSROOM_DIRECTORY)
    private readonly classrooms: ClassroomDirectoryPort,
  ) {}

  async resolve(classroomId: number | null, academicYear: number): Promise<ClassroomInfo | null> {
    if (classroomId === null) return null;
    const classroom = await this.classrooms.findById(classroomId);
    if (!classroom) throw new NotFoundError('Salón', classroomId);
    if (classroom.academicYear !== academicYear) {
      throw new BusinessRuleViolationError(
        `El salón "${classroom.name}" no pertenece al año lectivo ${academicYear}.`,
        'CLASSROOM_NOT_IN_ACADEMIC_YEAR',
        { classroomYear: classroom.academicYear, academicYear },
      );
    }
    return classroom;
  }
}
