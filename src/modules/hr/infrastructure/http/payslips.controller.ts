import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetPayslipUseCase } from '../../application/documents/get-payslip.use-case.js';
import { RenderPayslipUseCase } from '../../application/documents/render-payslip.use-case.js';
import { sendDocument } from './send-document.js';

/** Any payslip for HR, finance and administrators. */
@ApiTags('Nómina - Desprendibles')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR, Role.FINANCE)
@Controller('payroll/payslips')
export class PayslipsController {
  constructor(
    private readonly getPayslip: GetPayslipUseCase,
    private readonly renderPayslip: RenderPayslipUseCase,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Datos del desprendible' })
  get(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.getPayslip.execute({ actor, paymentId: id });
  }

  @Get(':id/document')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Desprendible en PDF' })
  async document(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendDocument(res, await this.renderPayslip.execute({ actor, paymentId: id }));
  }
}
