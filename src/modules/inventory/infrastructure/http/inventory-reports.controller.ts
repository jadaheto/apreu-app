import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetInventoryKpisUseCase } from '../../application/get-inventory-kpis.use-case.js';
import { GetInventoryValuationUseCase } from '../../application/get-inventory-valuation.use-case.js';
import { GetStockAlertsUseCase } from '../../application/get-stock-alerts.use-case.js';

@ApiTags('Inventario - Indicadores')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('inventory')
export class InventoryReportsController {
  constructor(
    private readonly kpis: GetInventoryKpisUseCase,
    private readonly alerts: GetStockAlertsUseCase,
    private readonly valuation: GetInventoryValuationUseCase,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Total de ítems, valor del inventario, stock bajo y sin stock' })
  getKpis() {
    return this.kpis.execute();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Ítems sin stock o por debajo del stock mínimo' })
  getAlerts() {
    return this.alerts.execute();
  }

  @Get('valuation')
  @ApiOperation({ summary: 'Valoración del inventario por categoría (costo promedio)' })
  getValuation() {
    return this.valuation.execute();
  }
}
