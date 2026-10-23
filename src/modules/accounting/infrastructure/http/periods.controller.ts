import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ClosePeriodUseCase } from '../../application/close-period.use-case.js';
import { CreatePeriodUseCase } from '../../application/create-period.use-case.js';
import { GetCurrentPeriodUseCase } from '../../application/get-current-period.use-case.js';
import { ListPeriodsUseCase } from '../../application/list-periods.use-case.js';
import { ReopenPeriodUseCase } from '../../application/reopen-period.use-case.js';
import { ACCOUNTING_ROLES } from './accounting-roles.js';
import { CreateAccountingPeriodDto, ReasonDto } from './dto/period.dto.js';

@ApiTags('Contabilidad - Periodos')
@ApiBearerAuth()
@Roles(...ACCOUNTING_ROLES)
@Controller('accounting/periods')
export class PeriodsController {
  constructor(
    private readonly listPeriods: ListPeriodsUseCase,
    private readonly currentPeriod: GetCurrentPeriodUseCase,
    private readonly createPeriod: CreatePeriodUseCase,
    private readonly closePeriod: ClosePeriodUseCase,
    private readonly reopenPeriod: ReopenPeriodUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Periodos contables (más recientes primero)' })
  list() {
    return this.listPeriods.execute();
  }

  @Get('current')
  @ApiOperation({ summary: 'Periodo que contiene la fecha de hoy' })
  current() {
    return this.currentPeriod.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Crea un periodo (abierto, sin solapamientos)' })
  create(@Body() dto: CreateAccountingPeriodDto) {
    return this.createPeriod.execute(dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra el periodo' })
  close(@Param('id', ParseIntPipe) periodId: number, @CurrentActor() actor: AuthenticatedActor) {
    return this.closePeriod.execute({ periodId, actor });
  }

  @Post(':id/reopen')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reabre el periodo (sólo administrador, con motivo)' })
  reopen(
    @Param('id', ParseIntPipe) periodId: number,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.reopenPeriod.execute({ periodId, reason: dto.reason, actor });
  }
}
