import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { AcademicYearQueryDto } from '../../../common/infrastructure/http/academic-query.dto.js';
import { GetDirectorDashboardUseCase } from '../../application/get-director-dashboard.use-case.js';
import { ListDirectedClassroomsUseCase } from '../../application/list-directed-classrooms.use-case.js';
import { ListMyTeachingAssignmentsUseCase } from '../../application/list-my-teaching-assignments.use-case.js';

/** Any staff member can be a group director (legacy `employee/group_director.php`). */
const STAFF_ROLES = [Role.ADMIN, Role.TEACHER, Role.EMPLOYEE, Role.HR, Role.FINANCE];

/** Teacher and group director portal (legacy `employee/my_groups.php`, `employee/group_director.php`). */
@ApiTags('Académico · Portal docente')
@ApiBearerAuth()
@Controller('academic')
export class TeacherPortalController {
  constructor(
    private readonly myAssignments: ListMyTeachingAssignmentsUseCase,
    private readonly directedClassrooms: ListDirectedClassroomsUseCase,
    private readonly directorDashboard: GetDirectorDashboardUseCase,
  ) {}

  @Get('me/assignments')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Mis grupos y materias asignadas en el año lectivo' })
  assignments(@CurrentActor() actor: AuthenticatedActor, @Query() query: AcademicYearQueryDto) {
    return this.myAssignments.execute({ actor, year: query.year });
  }

  @Get('director/classrooms')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Salones que dirijo (admin: todos los del año)' })
  classrooms(@CurrentActor() actor: AuthenticatedActor) {
    return this.directedClassrooms.execute(actor);
  }

  @Get('director/classrooms/:classroomId/dashboard')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Panel del director: alumnos, género y fallas del mes' })
  dashboard(@CurrentActor() actor: AuthenticatedActor, @Param('classroomId', ParseIntPipe) classroomId: number) {
    return this.directorDashboard.execute({ actor, classroomId });
  }
}
