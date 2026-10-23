import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ApplyCreditBalanceUseCase } from '../../application/apply-credit-balance.use-case.js';
import { GetAccountStatementUseCase } from '../../application/get-account-statement.use-case.js';
import { ListStudentChargesUseCase } from '../../application/list-student-charges.use-case.js';
import { ListStudentPaymentsUseCase } from '../../application/list-student-payments.use-case.js';
import { SearchStudentsForBillingUseCase } from '../../application/search-students-for-billing.use-case.js';
import { SearchStudentsQueryDto } from './dto/reports.dto.js';
import { FINANCE_STAFF, FINANCE_STAFF_AND_PORTAL } from './finance-roles.js';

@ApiTags('Finanzas · Estado de cuenta')
@ApiBearerAuth()
@Controller('finance/students')
export class StudentAccountsController {
  constructor(
    private readonly searchStudents: SearchStudentsForBillingUseCase,
    private readonly accountStatement: GetAccountStatementUseCase,
    private readonly studentCharges: ListStudentChargesUseCase,
    private readonly studentPayments: ListStudentPaymentsUseCase,
    private readonly applyCredit: ApplyCreditBalanceUseCase,
  ) {}

  @Get('search')
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Busca estudiantes activos por nombre, código o documento' })
  search(@Query() query: SearchStudentsQueryDto) {
    return this.searchStudents.execute({ term: query.q, limit: query.limit });
  }

  @Get(':id/account-statement')
  @Roles(...FINANCE_STAFF_AND_PORTAL)
  @ApiOperation({ summary: 'Estado de cuenta del estudiante (estudiante/acudiente: sólo propios)' })
  statement(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: AuthenticatedActor) {
    return this.accountStatement.execute({ studentId: id, actor });
  }

  @Get(':id/charges')
  @Roles(...FINANCE_STAFF_AND_PORTAL)
  @ApiOperation({ summary: 'Cargos del estudiante con saldo (estudiante/acudiente: sólo propios)' })
  charges(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: AuthenticatedActor) {
    return this.studentCharges.execute({ studentId: id, actor });
  }

  @Get(':id/payments')
  @Roles(...FINANCE_STAFF_AND_PORTAL)
  @ApiOperation({ summary: 'Pagos del estudiante (estudiante/acudiente: sólo propios)' })
  payments(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: AuthenticatedActor) {
    return this.studentPayments.execute({ studentId: id, actor });
  }

  @Post(':id/credit/apply')
  @Roles(...FINANCE_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aplica el saldo a favor del estudiante a sus cargos pendientes' })
  applyCreditBalance(@Param('id', ParseIntPipe) id: number) {
    return this.applyCredit.execute({ studentId: id });
  }
}
