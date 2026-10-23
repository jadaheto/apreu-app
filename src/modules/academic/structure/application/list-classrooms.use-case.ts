import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { CLASSROOM_REPOSITORY, type ClassroomRepository } from '../domain/structure.repositories.js';
import { ClassroomOverviewService } from './classroom-overview.service.js';
import type { ClassroomView } from './structure-views.js';

export interface ListClassroomsInput {
  /** Defaults to `settings.academic_year`. */
  year?: number;
}

/** Classrooms of an academic year with grade, director and student count. */
@Injectable()
export class ListClassroomsUseCase implements UseCase<ListClassroomsInput, ClassroomView[]> {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute({ year }: ListClassroomsInput): Promise<ClassroomView[]> {
    const academicYear = year ?? (await this.settings.currentAcademicYear());
    return this.overview.describe(await this.classrooms.listByYear(academicYear));
  }
}
