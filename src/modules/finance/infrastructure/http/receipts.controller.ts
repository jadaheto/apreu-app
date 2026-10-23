import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetReceiptUseCase } from '../../application/get-receipt.use-case.js';
import { FINANCE_STAFF_AND_PORTAL } from './finance-roles.js';

@ApiTags('Finanzas · Caja y pagos')
@ApiBearerAuth()
@Controller('finance/receipts')
export class ReceiptsController {
  constructor(private readonly getReceipt: GetReceiptUseCase) {}

  @Get(':receiptNumber')
  @Roles(...FINANCE_STAFF_AND_PORTAL)
  @ApiOperation({ summary: 'Datos del recibo de caja imprimible (estudiante/acudiente: sólo propios)' })
  get(@Param('receiptNumber') receiptNumber: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.getReceipt.execute({ receiptNumber, actor });
  }
}
