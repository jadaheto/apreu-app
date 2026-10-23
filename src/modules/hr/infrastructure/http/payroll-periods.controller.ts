import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ApprovePayrollPeriodUseCase } from '../../application/payroll/approve-payroll-period.use-case.js';
import { CalculatePayrollPeriodUseCase } from '../../application/payroll/calculate-payroll-period.use-case.js';
import { CancelPayrollPeriodUseCase } from '../../application/payroll/cancel-payroll-period.use-case.js';
import { CreatePayrollPeriodUseCase } from '../../application/payroll/create-payroll-period.use-case.js';
import { GetPayrollKpisUseCase } from '../../application/payroll/get-payroll-kpis.use-case.js';
import { GetPayrollPeriodDetailUseCase } from '../../application/payroll/get-payroll-period-detail.use-case.js';
import { ListPayrollPeriodsUseCase } from '../../application/payroll/list-payroll-periods.use-case.js';
import { PayPayrollPeriodUseCase } from '../../application/payroll/pay-payroll-period.use-case.js';
import { RegisterPayrollNoveltyUseCase } from '../../application/payroll/register-payroll-novelty.use-case.js';
import { RemovePayrollNoveltyUseCase } from '../../application/payroll/remove-payroll-novelty.use-case.js';
import {
  CancelPayrollPeriodDto,
  CreatePayrollPeriodDto,
  ListPayrollPeriodsQueryDto,
  PayrollKpisQueryDto,
  RegisterNoveltyDto,
} from './dto/payroll.dto.js';

/**
 * Payroll periods and their state machine (legacy `hr/payroll.php`, which had
 * no role check at all, S-1).
 */
@ApiTags('Nómina - Períodos')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR)
@Controller('payroll')
export class PayrollPeriodsController {
  constructor(
    private readonly listPeriods: ListPayrollPeriodsUseCase,
    private readonly getKpis: GetPayrollKpisUseCase,
    private readonly createPeriod: CreatePayrollPeriodUseCase,
    private readonly getDetail: GetPayrollPeriodDetailUseCase,
    private readonly registerNovelty: RegisterPayrollNoveltyUseCase,
    private readonly removeNovelty: RemovePayrollNoveltyUseCase,
    private readonly calculatePeriod: CalculatePayrollPeriodUseCase,
    private readonly approvePeriod: ApprovePayrollPeriodUseCase,
    private readonly payPeriod: PayPayrollPeriodUseCase,
    private readonly cancelPeriod: CancelPayrollPeriodUseCase,
  ) {}

  @Get('periods')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Períodos de nómina (filtros año y estado)' })
  list(@Query() query: ListPayrollPeriodsQueryDto) {
    return this.listPeriods.execute({
      criteria: { year: query.year, status: query.status },
      page: query.toPageRequest(),
    });
  }

  @Get('kpis')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Indicadores de nómina de un mes (AAAA-MM)' })
  kpis(@Query() query: PayrollKpisQueryDto) {
    return this.getKpis.execute(query.month);
  }

  @Post('periods')
  @ApiOperation({ summary: 'Crea un período en borrador (mensual o quincenal)' })
  create(@CurrentActor() actor: AuthenticatedActor, @Body() dto: CreatePayrollPeriodDto) {
    return this.createPeriod.execute({ actor, ...dto });
  }

  @Get('periods/:id')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Detalle del período: desprendibles, novedades y costo del empleador' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.getDetail.execute(id);
  }

  @Post('periods/:id/novelties')
  @ApiOperation({ summary: 'Registra una novedad (horas extra, bonificación, libranza, sindicato, embargo, otro)' })
  addNovelty(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegisterNoveltyDto,
  ) {
    return this.registerNovelty.execute({ actor, periodId: id, ...dto });
  }

  @Delete('periods/:id/novelties/:noveltyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una novedad de un período editable' })
  async deleteNovelty(
    @Param('id', ParseIntPipe) id: number,
    @Param('noveltyId', ParseIntPipe) noveltyId: number,
  ): Promise<void> {
    await this.removeNovelty.execute({ periodId: id, noveltyId });
  }

  @Post('periods/:id/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liquida (o reliquida) el período' })
  calculate(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.calculatePeriod.execute({ actor, periodId: id });
  }

  @Post('periods/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprueba el período (RR. HH.: quien liquida no puede aprobar)' })
  approve(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.approvePeriod.execute({ actor, periodId: id });
  }

  @Post('periods/:id/pay')
  @Roles(Role.ADMIN, Role.FINANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra el pago y publica hr.payroll-period-paid' })
  pay(@Param('id', ParseIntPipe) id: number) {
    return this.payPeriod.execute(id);
  }

  @Post('periods/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula un período en borrador o liquidado' })
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelPayrollPeriodDto) {
    return this.cancelPeriod.execute({ periodId: id, reason: dto.reason });
  }
}
