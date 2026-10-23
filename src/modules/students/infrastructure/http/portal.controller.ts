import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetPortalDashboardUseCase } from '../../application/get-portal-dashboard.use-case.js';
import { GetStudentDetailsUseCase } from '../../application/get-student-details.use-case.js';
import { ListStudentIncidentsUseCase } from '../../application/list-student-incidents.use-case.js';
import { ReportStudentIncidentUseCase } from '../../application/report-student-incident.use-case.js';
import { ResolvePortalContextUseCase } from '../../application/resolve-portal-context.use-case.js';
import { ReportIncidentDto } from './dto/incident.dto.js';

/**
 * Student/guardian portal (legacy `student/*.php`). The student is always
 * explicit in the URL and its ownership is checked in every use case.
 */
@ApiTags('Portal estudiante/acudiente')
@ApiBearerAuth()
@Roles(Role.STUDENT, Role.PARENT)
@Controller('portal')
export class PortalController {
  constructor(
    private readonly portalContext: ResolvePortalContextUseCase,
    private readonly dashboard: GetPortalDashboardUseCase,
    private readonly details: GetStudentDetailsUseCase,
    private readonly studentIncidents: ListStudentIncidentsUseCase,
    private readonly reportIncident: ReportStudentIncidentUseCase,
  ) {}

  @Get('context')
  @ApiOperation({
    summary: 'Estudiantes visibles para el usuario (propio o hijos activos)',
  })
  context(@CurrentActor() actor: AuthenticatedActor) {
    return this.portalContext.execute(actor);
  }

  @Get('students/:id/dashboard')
  @ApiOperation({
    summary: 'Inicio del portal: saldo, rendimiento e incidencias recientes',
  })
  home(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.dashboard.execute({ actor, studentId: id });
  }

  @Get('students/:id/profile')
  @ApiOperation({ summary: 'Perfil del estudiante (solo lectura)' })
  profile(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.details.execute({ actor, studentId: id });
  }

  @Get('students/:id/incidents')
  @ApiOperation({ summary: 'Incidencias del estudiante' })
  incidents(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentIncidents.execute({
      actor,
      studentId: id,
      page: query.toPageRequest(),
    });
  }

  @Post('students/:id/incidents')
  @ApiOperation({ summary: 'Reporta una incidencia del estudiante' })
  report(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReportIncidentDto,
  ) {
    return this.reportIncident.execute({ actor, studentId: id, ...dto });
  }
}
