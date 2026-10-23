import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { ClassroomOverviewService } from '../../structure/application/classroom-overview.service.js';
import type { ClassroomView } from '../../structure/application/structure-views.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GROUP_DIRECTORSHIP_REPOSITORY,
  type GroupDirectorshipRepository,
} from '../../structure/domain/structure.repositories.js';

/**
 * Classrooms the actor directs (legacy "Mi Grupo" menu, `includes/sidebar.php`).
 * Being an active group director grants access regardless of the base role
 * (rule 10); admins see every classroom of the current year.
 */
@Injectable()
export class ListDirectedClassroomsUseCase implements UseCase<AuthenticatedActor, ClassroomView[]> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(GROUP_DIRECTORSHIP_REPOSITORY) private readonly directorships: GroupDirectorshipRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<ClassroomView[]> {
    if (this.access.isAdministrator(actor)) {
      return this.overview.describe(await this.classrooms.listByYear(await this.settings.currentAcademicYear()));
    }
    const employee = await this.access.requireEmployee(actor);
    const directorships = await this.directorships.listActiveByEmployee(employee.id);
    const classrooms = await this.classrooms.findByIds(directorships.map((d) => d.classroomId));
    return this.overview.describe(
      classrooms.sort((a, b) => b.academicYear - a.academicYear || a.name.localeCompare(b.name)),
    );
  }
}
