import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateBillingConceptUseCase } from '../../application/create-billing-concept.use-case.js';
import { ListBillingConceptsUseCase } from '../../application/list-billing-concepts.use-case.js';
import { SetBillingConceptActiveUseCase } from '../../application/set-billing-concept-active.use-case.js';
import { UpdateBillingConceptUseCase } from '../../application/update-billing-concept.use-case.js';
import { ListConceptsQueryDto, SaveBillingConceptDto, SetActiveDto } from './dto/billing-concept.dto.js';
import { FINANCE_ADMIN, FINANCE_STAFF } from './finance-roles.js';

@ApiTags('Finanzas · Conceptos de cobro')
@ApiBearerAuth()
@Controller('finance/concepts')
export class BillingConceptsController {
  constructor(
    private readonly listConcepts: ListBillingConceptsUseCase,
    private readonly createConcept: CreateBillingConceptUseCase,
    private readonly updateConcept: UpdateBillingConceptUseCase,
    private readonly setActive: SetBillingConceptActiveUseCase,
  ) {}

  @Get()
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Lista los conceptos de cobro' })
  list(@Query() query: ListConceptsQueryDto) {
    return this.listConcepts.execute({ active: query.active });
  }

  @Post()
  @Roles(...FINANCE_ADMIN)
  @ApiOperation({ summary: 'Crea un concepto de cobro' })
  create(@Body() dto: SaveBillingConceptDto) {
    return this.createConcept.execute(dto);
  }

  @Put(':id')
  @Roles(...FINANCE_ADMIN)
  @ApiOperation({ summary: 'Edita un concepto de cobro' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveBillingConceptDto) {
    return this.updateConcept.execute({ id, ...dto });
  }

  @Patch(':id/active')
  @Roles(...FINANCE_ADMIN)
  @ApiOperation({ summary: 'Activa o desactiva un concepto (no se eliminan)' })
  toggle(@Param('id', ParseIntPipe) id: number, @Body() dto: SetActiveDto) {
    return this.setActive.execute({ id, active: dto.active });
  }
}
