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
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetIncomeCertificateUseCase } from '../../application/documents/get-income-certificate.use-case.js';
import { IssueEmploymentCertificateUseCase } from '../../application/documents/issue-employment-certificate.use-case.js';
import { RenderIncomeCertificateUseCase } from '../../application/documents/render-income-certificate.use-case.js';
import { ListPayslipsUseCase } from '../../application/documents/list-payslips.use-case.js';
import { ChangeEmployeeStatusUseCase } from '../../application/employees/change-employee-status.use-case.js';
import { GetEmployeeKpisUseCase } from '../../application/employees/get-employee-kpis.use-case.js';
import { GetEmployeeUseCase } from '../../application/employees/get-employee.use-case.js';
import { ListEmployeesUseCase } from '../../application/employees/list-employees.use-case.js';
import { RegisterEmployeeUseCase } from '../../application/employees/register-employee.use-case.js';
import { RetireEmployeeUseCase } from '../../application/employees/retire-employee.use-case.js';
import { UpdateEmployeeUseCase } from '../../application/employees/update-employee.use-case.js';
import {
  ChangeEmployeeStatusDto,
  EmployeeDataDto,
  IssueCertificateDto,
  ListEmployeesQueryDto,
  RegisterEmployeeDto,
  RetireEmployeeDto,
  YearQueryDto,
} from './dto/employee.dto.js';
import { sendDocument } from './send-document.js';

/** Employee directory managed by HR (legacy `hr/index.php`, `hr/employees.php`). There is no DELETE: use retirement. */
@ApiTags('RR. HH. - Empleados')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR)
@Controller('hr/employees')
export class EmployeesController {
  constructor(
    private readonly listEmployees: ListEmployeesUseCase,
    private readonly getKpis: GetEmployeeKpisUseCase,
    private readonly registerEmployee: RegisterEmployeeUseCase,
    private readonly getEmployee: GetEmployeeUseCase,
    private readonly updateEmployee: UpdateEmployeeUseCase,
    private readonly changeStatus: ChangeEmployeeStatusUseCase,
    private readonly retireEmployee: RetireEmployeeUseCase,
    private readonly listPayslips: ListPayslipsUseCase,
    private readonly issueCertificate: IssueEmploymentCertificateUseCase,
    private readonly incomeCertificate: GetIncomeCertificateUseCase,
    private readonly renderIncomeCertificate: RenderIncomeCertificateUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Directorio de empleados con búsqueda y filtros' })
  list(@Query() query: ListEmployeesQueryDto) {
    return this.listEmployees.execute({
      criteria: { search: query.search, type: query.type, status: query.status },
      page: query.toPageRequest(),
    });
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Indicadores del directorio (activos por tipo, en licencia)' })
  kpis() {
    return this.getKpis.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Registra un empleado y crea o vincula su usuario del portal' })
  register(@Body() dto: RegisterEmployeeDto) {
    const { createUserAccount, ...data } = dto;
    return this.registerEmployee.execute({ data, createUserAccount });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha completa de un empleado' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.getEmployee.execute(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza datos personales, contrato, banco, seguridad social y deducciones' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: EmployeeDataDto) {
    return this.updateEmployee.execute({ employeeId: id, data: dto });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambia el estado del empleado y sincroniza el acceso del usuario' })
  status(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeEmployeeStatusDto,
  ) {
    return this.changeStatus.execute({ actor, employeeId: id, status: dto.status });
  }

  @Post(':id/retirement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retiro lógico con fecha y motivo (conserva el historial)' })
  retire(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RetireEmployeeDto,
  ) {
    return this.retireEmployee.execute({ actor, employeeId: id, ...dto });
  }

  @Get(':id/payslips')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Historial de desprendibles del empleado' })
  payslips(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.listPayslips.execute({ actor, employeeId: id, page: query.toPageRequest() });
  }

  @Post(':id/certificates/employment')
  @ApiOperation({ summary: 'Expide un certificado laboral con código de verificación' })
  certificate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IssueCertificateDto,
  ) {
    return this.issueCertificate.execute({
      actor,
      employeeId: id,
      includeSalary: dto.includeSalary ?? true,
      addressee: dto.addressee,
    });
  }

  @Get(':id/income-certificate')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Resumen de ingresos y retenciones del año (informativo)' })
  income(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: YearQueryDto,
  ) {
    return this.incomeCertificate.execute({ actor, employeeId: id, year: query.year });
  }

  @Get(':id/income-certificate/document')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Certificado de ingresos y retenciones del año en PDF' })
  async incomeDocument(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: YearQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendDocument(res, await this.renderIncomeCertificate.execute({ actor, employeeId: id, year: query.year }));
  }
}
