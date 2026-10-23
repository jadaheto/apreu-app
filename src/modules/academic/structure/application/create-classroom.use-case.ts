import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { requireFound } from '../../common/domain/require-found.js';
import { Classroom } from '../domain/classroom.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GRADE_REPOSITORY,
  type GradeRepository,
} from '../domain/structure.repositories.js';
import { ClassroomOverviewService } from './classroom-overview.service.js';
import type { ClassroomView } from './structure-views.js';

export interface CreateClassroomInput {
  gradeId: number;
  name: string;
  capacity?: number;
  /** Defaults to `settings.academic_year`. */
  academicYear?: number;
}

/** Opens a classroom of a grade for an academic year (legacy action `create_classroom`). */
@Injectable()
export class CreateClassroomUseCase implements UseCase<CreateClassroomInput, ClassroomView> {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute(input: CreateClassroomInput): Promise<ClassroomView> {
    requireFound(await this.grades.findById(input.gradeId), 'Grado', input.gradeId);
    const classroom = Classroom.create({
      ...input,
      academicYear: input.academicYear ?? (await this.settings.currentAcademicYear()),
    });
    await this.classrooms.save(classroom);
    const [view] = await this.overview.describe([classroom]);
    return view;
  }
}
