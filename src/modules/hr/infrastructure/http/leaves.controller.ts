import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ApproveLeaveUseCase } from '../../application/leaves/approve-leave.use-case.js';
import { CancelLeaveUseCase } from '../../application/leaves/cancel-leave.use-case.js';
import { ListLeavesUseCase } from '../../application/leaves/list-leaves.use-case.js';
import { RejectLeaveUseCase } from '../../application/leaves/reject-leave.use-case.js';
import { RequestLeaveUseCase } from '../../application/leaves/request-leave.use-case.js';
import { ApproveLeaveDto, HrRequestLeaveDto, ListLeavesQueryDto, RejectLeaveDto } from './dto/leave.dto.js';

/** HR inbox of permissions and absences with the approval workflow (new; legacy B-22). */
@ApiTags('RR. HH. - Permisos')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR)
@Controller('hr/leaves')
export class LeavesController {
  constructor(
    private readonly listLeaves: ListLeavesUseCase,
    private readonly requestLeave: RequestLeaveUseCase,
    private readonly approveLeave: ApproveLeaveUseCase,
    private readonly rejectLeave: RejectLeaveUseCase,
    private readonly cancelLeave: CancelLeaveUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Solicitudes de permiso con filtros' })
  list(@Query() query: ListLeavesQueryDto) {
    return this.listLeaves.execute({
      criteria: { status: query.status, employeeId: query.employeeId, from: query.from, to: query.to },
      page: query.toPageRequest(),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Registra un permiso en nombre de un empleado' })
  create(@CurrentActor() actor: AuthenticatedActor, @Body() dto: HrRequestLeaveDto) {
    return this.requestLeave.execute({ actor, ...dto });
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprueba una solicitud pendiente' })
  approve(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.approveLeave.execute({ actor, leaveId: id, note: dto.note });
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechaza una solicitud pendiente con motivo' })
  reject(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.rejectLeave.execute({ actor, leaveId: id, reason: dto.reason });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela una solicitud pendiente o un permiso aprobado no terminado' })
  cancel(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.cancelLeave.execute({ actor, leaveId: id });
  }
}
