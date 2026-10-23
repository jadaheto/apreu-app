import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateIncidentUseCase } from '../../application/create-incident.use-case.js';
import { GetIncidentKpisUseCase } from '../../application/get-incident-kpis.use-case.js';
import { GetIncidentUseCase } from '../../application/get-incident.use-case.js';
import { ListIncidentsUseCase } from '../../application/list-incidents.use-case.js';
import { ReviewIncidentUseCase } from '../../application/review-incident.use-case.js';
import { CreateIncidentDto, ListIncidentsQueryDto, ReviewIncidentDto } from './dto/incident.dto.js';

/** Staff inbox of incidents and requests with approval workflow (legacy `incidents/index.php`). */
@ApiTags('Incidencias')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly listIncidents: ListIncidentsUseCase,
    private readonly incidentKpis: GetIncidentKpisUseCase,
    private readonly getIncident: GetIncidentUseCase,
    private readonly createIncident: CreateIncidentUseCase,
    private readonly reviewIncident: ReviewIncidentUseCase,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Lista incidencias (más recientes primero)' })
  list(@Query() query: ListIncidentsQueryDto) {
    return this.listIncidents.execute({
      criteria: {
        status: query.status,
        type: query.type,
        studentId: query.studentId,
      },
      page: query.toPageRequest(),
    });
  }

  @Get('kpis')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Cantidad de incidencias por estado' })
  kpis() {
    return this.incidentKpis.execute();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Detalle de una incidencia' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.getIncident.execute(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE, Role.TEACHER)
  @ApiOperation({ summary: 'Crea una solicitud/incidencia' })
  create(@CurrentActor() actor: AuthenticatedActor, @Body() dto: CreateIncidentDto) {
    return this.createIncident.execute({ actor, ...dto });
  }

  @Post(':id/review')
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revisa una incidencia: en revisión, aprobar, rechazar o cerrar',
  })
  review(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewIncidentDto,
  ) {
    return this.reviewIncident.execute({
      actor,
      incidentId: id,
      action: dto.action,
      notes: dto.notes,
    });
  }
}
