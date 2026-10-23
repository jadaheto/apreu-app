import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetWhatsAppKpisUseCase } from '../../application/whatsapp/get-whatsapp-kpis.use-case.js';
import { ListWhatsAppLogsUseCase } from '../../application/whatsapp/list-whatsapp-logs.use-case.js';
import { NotifyEventUseCase } from '../../application/whatsapp/notify-event.use-case.js';
import { SendPaymentConfirmationUseCase } from '../../application/whatsapp/send-payment-confirmation.use-case.js';
import { SendSingleWhatsAppUseCase } from '../../application/whatsapp/send-single-whatsapp.use-case.js';
import { NotifyEventDto, SendWhatsAppMessageDto, WhatsAppLogsQueryDto } from './dto/whatsapp.dto.js';

/** WhatsApp: dashboard, history and sends. */
@ApiTags('Comunicaciones · WhatsApp')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR, Role.FINANCE)
@Controller('communications/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly kpis: GetWhatsAppKpisUseCase,
    private readonly logs: ListWhatsAppLogsUseCase,
    private readonly single: SendSingleWhatsAppUseCase,
    private readonly event: NotifyEventUseCase,
    private readonly paymentConfirmation: SendPaymentConfirmationUseCase,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Estado de la API y totales por estado (enviados, entregados, leídos, fallidos)' })
  getKpis() {
    return this.kpis.execute();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Historial de envíos (paginado)' })
  listLogs(@Query() query: WhatsAppLogsQueryDto) {
    return this.logs.execute({ criteria: { status: query.status, search: query.search }, page: query.toPageRequest() });
  }

  @Post('messages')
  @ApiOperation({ summary: 'Envía una plantilla a un número' })
  sendMessage(@CurrentActor() actor: AuthenticatedActor, @Body() dto: SendWhatsAppMessageDto) {
    return this.single.execute({ actor, phone: dto.phone, templateName: dto.templateName, variables: dto.variables });
  }

  @Post('events')
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Notifica un evento institucional a todos los acudientes con móvil' })
  notifyEvent(@CurrentActor() actor: AuthenticatedActor, @Body() dto: NotifyEventDto) {
    return this.event.execute({ actor, date: dto.date, name: dto.name, details: dto.details });
  }

  @Post('payment-confirmations/:paymentId')
  @Roles(Role.ADMIN, Role.FINANCE)
  @ApiOperation({ summary: 'Confirma un pago al acudiente por WhatsApp' })
  confirmPayment(@CurrentActor() actor: AuthenticatedActor, @Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.paymentConfirmation.execute({ paymentId, userId: actor.userId });
  }
}
