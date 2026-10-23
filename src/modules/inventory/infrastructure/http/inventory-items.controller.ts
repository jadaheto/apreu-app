import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateItemUseCase } from '../../application/create-item.use-case.js';
import { DeactivateItemUseCase } from '../../application/deactivate-item.use-case.js';
import { GetItemUseCase } from '../../application/get-item.use-case.js';
import { ListItemsUseCase } from '../../application/list-items.use-case.js';
import { ListStockMovementsUseCase } from '../../application/list-stock-movements.use-case.js';
import { RegisterStockMovementUseCase } from '../../application/register-stock-movement.use-case.js';
import { UpdateItemUseCase } from '../../application/update-item.use-case.js';
import { CreateItemDto, ItemDto, ListItemsQueryDto, StockMovementDto } from './dto/inventory.dto.js';

/** `enforcePageAccess('inventory')`: admin only (superadmin always passes). */
@ApiTags('Inventario - Ítems')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('inventory/items')
export class InventoryItemsController {
  constructor(
    private readonly listItems: ListItemsUseCase,
    private readonly getItem: GetItemUseCase,
    private readonly createItem: CreateItemUseCase,
    private readonly updateItem: UpdateItemUseCase,
    private readonly deactivateItem: DeactivateItemUseCase,
    private readonly registerMovement: RegisterStockMovementUseCase,
    private readonly listMovements: ListStockMovementsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista ítems por nombre/SKU, categoría y alerta de stock' })
  list(@Query() query: ListItemsQueryDto) {
    return this.listItems.execute({
      search: query.search,
      categoryId: query.categoryId,
      alert: query.alert,
      includeInactive: query.includeInactive,
      page: query.toPageRequest(),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un ítem' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.getItem.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un ítem (stock inicial como movimiento)' })
  create(@Body() dto: CreateItemDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.createItem.execute({ ...dto, categoryId: dto.categoryId ?? null, actor });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita los datos del ítem (el stock sólo cambia con movimientos)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ItemDto) {
    return this.updateItem.execute({ id, ...dto, categoryId: dto.categoryId ?? null });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva el ítem (borrado lógico)' })
  async deactivate(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deactivateItem.execute(id);
  }

  @Post(':id/movements')
  @ApiOperation({ summary: 'Registra entrada, salida o ajuste de stock' })
  addMovement(
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: StockMovementDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.registerMovement.execute({ itemId, ...dto, actor });
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Kardex del ítem' })
  movements(@Param('id', ParseIntPipe) itemId: number, @Query() query: PaginationQueryDto) {
    return this.listMovements.execute({ itemId, page: query.toPageRequest() });
  }
}
