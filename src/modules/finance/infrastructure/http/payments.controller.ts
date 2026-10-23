import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ListPaymentsUseCase } from '../../application/list-payments.use-case.js';
import { ReconcilePaymentUseCase } from '../../application/reconcile-payment.use-case.js';
import { RegisterPaymentUseCase } from '../../application/register-payment.use-case.js';
import { UnreconcilePaymentUseCase } from '../../application/unreconcile-payment.use-case.js';
import { VoidPaymentUseCase } from '../../application/void-payment.use-case.js';
import { ListPaymentsQueryDto, ReconcilePaymentDto, RegisterPaymentDto, VoidPaymentDto } from './dto/payment.dto.js';
import { FINANCE_ADMIN, FINANCE_STAFF } from './finance-roles.js';

@ApiTags('Finanzas · Caja y pagos')
@ApiBearerAuth()
@Controller('finance/payments')
export class PaymentsController {
  constructor(
    private readonly registerPayment: RegisterPaymentUseCase,
    private readonly listPayments: ListPaymentsUseCase,
    private readonly voidPayment: VoidPaymentUseCase,
    private readonly reconcilePayment: ReconcilePaymentUseCase,
    private readonly unreconcilePayment: UnreconcilePaymentUseCase,
  ) {}

  @Post()
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Registra un pago, lo aplica a los cargos más antiguos y emite el recibo' })
  register(@Body() dto: RegisterPaymentDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.registerPayment.execute({ ...dto, actor });
  }

  @Get()
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Lista pagos con filtros' })
  list(@Query() query: ListPaymentsQueryDto) {
    const { from, to, studentId, status, method, search } = query;
    return this.listPayments.execute({
      criteria: { from, to, studentId, status, method, search },
      page: query.toPageRequest(),
    });
  }

  @Post(':id/void')
  @Roles(...FINANCE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula un pago y revierte sus aplicaciones' })
  void(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidPaymentDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.voidPayment.execute({ paymentId: id, reason: dto.reason, actor });
  }

  @Post(':id/reconcile')
  @Roles(...FINANCE_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Concilia un pago con su referencia bancaria' })
  reconcile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReconcilePaymentDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.reconcilePayment.execute({ paymentId: id, bankRef: dto.bankRef, actor });
  }

  @Delete(':id/reconcile')
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Revierte la conciliación de un pago' })
  unreconcile(@Param('id', ParseIntPipe) id: number) {
    return this.unreconcilePayment.execute({ paymentId: id });
  }
}
