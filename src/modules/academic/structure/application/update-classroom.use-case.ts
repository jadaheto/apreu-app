import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GRADE_REPOSITORY,
  type GradeRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';
import { ClassroomOverviewService } from './classroom-overview.service.js';
import type { ClassroomView } from './structure-views.js';

export interface UpdateClassroomInput {
  classroomId: number;
  gradeId: number;
  name: string;
  capacity?: number;
  academicYear: number;
}

/**
 * Edits a classroom (legacy action `edit_classroom`). Changing its grade or
 * year is refused while it has teaching assignments, because they are bound to
 * the subjects of the grade and to the year.
 */
@Injectable()
export class UpdateClassroomUseCase implements UseCase<UpdateClassroomInput, ClassroomView> {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute({ classroomId, ...data }: UpdateClassroomInput): Promise<ClassroomView> {
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    requireFound(await this.grades.findById(data.gradeId), 'Grado', data.gradeId);
    const movesGradeOrYear = data.gradeId !== classroom.gradeId || data.academicYear !== classroom.academicYear;
    if (movesGradeOrYear && (await this.assignments.countByClassroom(classroomId)) > 0) {
      throw new ConflictError('No puede cambiar el grado ni el año de un salón que ya tiene carga académica asignada.');
    }
    classroom.update(data);
    await this.classrooms.save(classroom);
    const [view] = await this.overview.describe([classroom]);
    return view;
  }
}
