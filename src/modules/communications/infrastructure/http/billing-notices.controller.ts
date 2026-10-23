import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PreviewBillingNoticesUseCase } from '../../application/billing/preview-billing-notices.use-case.js';
import { SendBillingNoticesUseCase } from '../../application/billing/send-billing-notices.use-case.js';
import { BillingPreviewQueryDto, SendBillingNoticesDto } from './dto/billing-notices.dto.js';

/** Bulk billing notices (pending charges of a month) by e-mail and/or WhatsApp. */
@ApiTags('Comunicaciones · Avisos de cobro')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FINANCE)
@Controller('communications/billing-notices')
export class BillingNoticesController {
  constructor(
    private readonly preview: PreviewBillingNoticesUseCase,
    private readonly send: SendBillingNoticesUseCase,
  ) {}

  @Get('preview')
  @ApiOperation({ summary: 'Vista previa: cargos, total y acudientes alcanzables' })
  getPreview(@Query() query: BillingPreviewQueryDto) {
    return this.preview.execute({ month: query.month, conceptId: query.conceptId });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envía los avisos de cobro del mes por los canales elegidos' })
  sendNotices(@CurrentActor() actor: AuthenticatedActor, @Body() dto: SendBillingNoticesDto) {
    return this.send.execute({
      actor,
      month: dto.month,
      conceptId: dto.conceptId,
      channels: dto.channels,
      templateName: dto.templateName,
    });
  }
}
