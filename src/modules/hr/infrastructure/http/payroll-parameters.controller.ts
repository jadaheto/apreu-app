import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ConfigurePayrollParametersUseCase } from '../../application/payroll/configure-payroll-parameters.use-case.js';
import { GetPayrollParametersUseCase } from '../../application/payroll/get-payroll-parameters.use-case.js';
import { PayrollParametersDto } from './dto/payroll.dto.js';

/** Legal payroll parameters per year (SMMLV, auxilio de transporte, UVT, tasas, exoneración). */
@ApiTags('Nómina - Parámetros')
@ApiBearerAuth()
@Controller('payroll/parameters')
export class PayrollParametersController {
  constructor(
    private readonly getParameters: GetPayrollParametersUseCase,
    private readonly configureParameters: ConfigurePayrollParametersUseCase,
  ) {}

  @Get(':year')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Parámetros legales del año (configurados o valores legales incorporados)' })
  get(@Param('year', ParseIntPipe) year: number) {
    return this.getParameters.execute(year);
  }

  @Put(':year')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Configura los parámetros del año (bloqueado si hay nóminas pagadas)' })
  configure(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: PayrollParametersDto,
  ) {
    return this.configureParameters.execute({ actor, year, values: dto });
  }
}
