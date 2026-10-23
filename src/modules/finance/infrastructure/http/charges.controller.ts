import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CancelChargeUseCase } from '../../application/cancel-charge.use-case.js';
import { CreateIndividualChargeUseCase } from '../../application/create-individual-charge.use-case.js';
import { GenerateChargeBatchUseCase } from '../../application/generate-charge-batch.use-case.js';
import { GetChargeDocumentUseCase } from '../../application/get-charge-document.use-case.js';
import { GetChargesSummaryUseCase } from '../../application/get-charges-summary.use-case.js';
import { ListChargesUseCase } from '../../application/list-charges.use-case.js';
import { PreviewChargeBatchUseCase } from '../../application/preview-charge-batch.use-case.js';
import { ChargeBatchDto, ChargesSummaryQueryDto, IndividualChargeDto, ListChargesQueryDto } from './dto/charge.dto.js';
import { FINANCE_STAFF, FINANCE_STAFF_AND_PORTAL } from './finance-roles.js';

@ApiTags('Finanzas · Cargos')
@ApiBearerAuth()
@Controller('finance/charges')
export class ChargesController {
  constructor(
    private readonly previewBatch: PreviewChargeBatchUseCase,
    private readonly generateBatch: GenerateChargeBatchUseCase,
    private readonly createIndividual: CreateIndividualChargeUseCase,
    private readonly cancelCharge: CancelChargeUseCase,
    private readonly listCharges: ListChargesUseCase,
    private readonly chargesSummary: GetChargesSummaryUseCase,
    private readonly chargeDocument: GetChargeDocumentUseCase,
  ) {}

  @Post('batch/preview')
  @Roles(...FINANCE_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Previsualiza una generación masiva de cargos' })
  preview(@Body() dto: ChargeBatchDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.previewBatch.execute({ ...dto, createdBy: actor.userId });
  }

  @Post('batch')
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Genera cargos para los estudiantes activos (idempotente por mes)' })
  generate(@Body() dto: ChargeBatchDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.generateBatch.execute({ ...dto, createdBy: actor.userId });
  }

  @Post()
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Crea un cargo individual' })
  create(@Body() dto: IndividualChargeDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.createIndividual.execute({ ...dto, createdBy: actor.userId });
  }

  @Get()
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Lista cargos con filtros' })
  list(@Query() query: ListChargesQueryDto) {
    const { studentId, conceptId, status, period, overdueOnly, search } = query;
    return this.listCharges.execute({
      criteria: { studentId, conceptId, status, period, overdueOnly, search },
      page: query.toPageRequest(),
    });
  }

  @Get('summary')
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Resumen de cargos generados por concepto y mes' })
  summary(@Query() query: ChargesSummaryQueryDto) {
    return this.chargesSummary.execute({ limit: query.limit });
  }

  @Post(':id/cancel')
  @Roles(...FINANCE_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula un cargo pendiente sin abonos' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.cancelCharge.execute({ chargeId: id });
  }

  @Get(':id/document')
  @Roles(...FINANCE_STAFF_AND_PORTAL)
  @ApiOperation({ summary: 'Datos de la factura de cobro imprimible (estudiante/acudiente: sólo propios)' })
  document(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: AuthenticatedActor) {
    return this.chargeDocument.execute({ chargeId: id, actor });
  }
}
