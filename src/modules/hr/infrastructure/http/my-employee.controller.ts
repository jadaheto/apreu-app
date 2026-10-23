import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetIncomeCertificateUseCase } from '../../application/documents/get-income-certificate.use-case.js';
import { GetPayslipUseCase } from '../../application/documents/get-payslip.use-case.js';
import { IssueEmploymentCertificateUseCase } from '../../application/documents/issue-employment-certificate.use-case.js';
import { ListPayslipsUseCase } from '../../application/documents/list-payslips.use-case.js';
import { RenderIncomeCertificateUseCase } from '../../application/documents/render-income-certificate.use-case.js';
import { RenderPayslipUseCase } from '../../application/documents/render-payslip.use-case.js';
import { SELF_SERVICE_ROLES } from '../../application/hr-access.js';
import { CancelLeaveUseCase } from '../../application/leaves/cancel-leave.use-case.js';
import { ListMyLeavesUseCase } from '../../application/leaves/list-my-leaves.use-case.js';
import { RequestLeaveUseCase } from '../../application/leaves/request-leave.use-case.js';
import { GetMyDashboardUseCase } from '../../application/self-service/get-my-dashboard.use-case.js';
import { GetMyEmployeeProfileUseCase } from '../../application/self-service/get-my-employee-profile.use-case.js';
import { UpdateMyContactInfoUseCase } from '../../application/self-service/update-my-contact-info.use-case.js';
import { IssueCertificateDto, YearQueryDto } from './dto/employee.dto.js';
import { RequestLeaveDto } from './dto/leave.dto.js';
import { UpdateContactInfoDto } from './dto/self-service.dto.js';
import { sendDocument } from './send-document.js';

/**
 * Employee self-service (replaces `hr/portal.php` and `employee/*`, D-2).
 * Every endpoint acts on the employee linked to the token; there is no
 * `emp_id` parameter to tamper with.
 */
@ApiTags('Portal del empleado')
@ApiBearerAuth()
@Roles(...SELF_SERVICE_ROLES)
@Controller('me/employee')
export class MyEmployeeController {
  constructor(
    private readonly getProfile: GetMyEmployeeProfileUseCase,
    private readonly updateContact: UpdateMyContactInfoUseCase,
    private readonly getDashboard: GetMyDashboardUseCase,
    private readonly listPayslips: ListPayslipsUseCase,
    private readonly getPayslip: GetPayslipUseCase,
    private readonly renderPayslip: RenderPayslipUseCase,
    private readonly listLeaves: ListMyLeavesUseCase,
    private readonly requestLeave: RequestLeaveUseCase,
    private readonly cancelLeave: CancelLeaveUseCase,
    private readonly issueCertificate: IssueEmploymentCertificateUseCase,
    private readonly incomeCertificate: GetIncomeCertificateUseCase,
    private readonly renderIncomeCertificate: RenderIncomeCertificateUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mis datos de empleado' })
  profile(@CurrentActor() actor: AuthenticatedActor) {
    return this.getProfile.execute(actor);
  }

  @Patch('contact')
  @ApiOperation({
    summary: 'Actualiza celular, correo y dirección (deducciones y cuenta bancaria solo las cambia RR. HH.)',
  })
  contact(@CurrentActor() actor: AuthenticatedActor, @Body() dto: UpdateContactInfoDto) {
    return this.updateContact.execute({ actor, contact: dto });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Indicadores del portal (último pago, antigüedad, permisos)' })
  dashboard(@CurrentActor() actor: AuthenticatedActor) {
    return this.getDashboard.execute(actor);
  }

  @Get('payslips')
  @ApiOperation({ summary: 'Mis desprendibles (períodos aprobados o pagados)' })
  payslips(@CurrentActor() actor: AuthenticatedActor, @Query() query: PaginationQueryDto) {
    return this.listPayslips.execute({ actor, page: query.toPageRequest() });
  }

  @Get('payslips/:id')
  @ApiOperation({ summary: 'Datos de uno de mis desprendibles' })
  payslip(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.getPayslip.execute({ actor, paymentId: id });
  }

  @Get('payslips/:id/document')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Mi desprendible en PDF' })
  async payslipDocument(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendDocument(res, await this.renderPayslip.execute({ actor, paymentId: id }));
  }

  @Get('leaves')
  @ApiOperation({ summary: 'Mis solicitudes de permiso' })
  leaves(@CurrentActor() actor: AuthenticatedActor, @Query() query: PaginationQueryDto) {
    return this.listLeaves.execute({ actor, page: query.toPageRequest() });
  }

  @Post('leaves')
  @ApiOperation({ summary: 'Solicita un permiso' })
  requestLeaveFor(@CurrentActor() actor: AuthenticatedActor, @Body() dto: RequestLeaveDto) {
    return this.requestLeave.execute({ actor, ...dto });
  }

  @Post('leaves/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela una de mis solicitudes pendientes' })
  cancel(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.cancelLeave.execute({ actor, leaveId: id });
  }

  @Post('certificates/employment')
  @ApiOperation({ summary: 'Expide mi certificado laboral (con o sin salario)' })
  certificate(@CurrentActor() actor: AuthenticatedActor, @Body() dto: IssueCertificateDto) {
    return this.issueCertificate.execute({ actor, includeSalary: dto.includeSalary ?? true, addressee: dto.addressee });
  }

  @Get('income-certificate')
  @ApiOperation({ summary: 'Mi resumen de ingresos y retenciones del año (informativo)' })
  income(@CurrentActor() actor: AuthenticatedActor, @Query() query: YearQueryDto) {
    return this.incomeCertificate.execute({ actor, year: query.year });
  }

  @Get('income-certificate/document')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Mi certificado de ingresos y retenciones del año en PDF' })
  async incomeDocument(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: YearQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendDocument(res, await this.renderIncomeCertificate.execute({ actor, year: query.year }));
  }
}
