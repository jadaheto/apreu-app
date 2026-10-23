import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateExpenseUseCase } from '../../application/create-expense.use-case.js';
import { ListExpenseCategoriesUseCase } from '../../application/list-expense-categories.use-case.js';
import { ListExpensesUseCase } from '../../application/list-expenses.use-case.js';
import { SaveExpenseCategoryUseCase } from '../../application/save-expense-category.use-case.js';
import { CreateExpenseDto, ListExpensesQueryDto, SaveExpenseCategoryDto } from './dto/expense.dto.js';
import { FINANCE_STAFF } from './finance-roles.js';

@ApiTags('Finanzas · Gastos')
@ApiBearerAuth()
@Roles(...FINANCE_STAFF)
@Controller('finance')
export class ExpensesController {
  constructor(
    private readonly createExpense: CreateExpenseUseCase,
    private readonly listExpenses: ListExpensesUseCase,
    private readonly listCategories: ListExpenseCategoriesUseCase,
    private readonly saveCategory: SaveExpenseCategoryUseCase,
  ) {}

  @Get('expenses')
  @ApiOperation({ summary: 'Lista gastos con filtros' })
  list(@Query() query: ListExpensesQueryDto) {
    const { from, to, categoryId, search } = query;
    return this.listExpenses.execute({ criteria: { from, to, categoryId, search }, page: query.toPageRequest() });
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Registra un gasto' })
  create(@Body() dto: CreateExpenseDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.createExpense.execute({ ...dto, actor });
  }

  @Get('expense-categories')
  @ApiOperation({ summary: 'Lista las categorías de gasto' })
  categories() {
    return this.listCategories.execute();
  }

  @Post('expense-categories')
  @ApiOperation({ summary: 'Crea una categoría de gasto' })
  createCategory(@Body() dto: SaveExpenseCategoryDto) {
    return this.saveCategory.execute({ name: dto.name });
  }

  @Put('expense-categories/:id')
  @ApiOperation({ summary: 'Renombra una categoría de gasto' })
  renameCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveExpenseCategoryDto) {
    return this.saveCategory.execute({ id, name: dto.name });
  }
}
