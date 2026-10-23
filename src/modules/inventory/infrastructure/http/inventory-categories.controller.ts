import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { DeleteCategoryUseCase } from '../../application/delete-category.use-case.js';
import { ListCategoriesUseCase } from '../../application/list-categories.use-case.js';
import { SaveCategoryUseCase } from '../../application/save-category.use-case.js';
import { CategoryDto } from './dto/inventory.dto.js';

@ApiTags('Inventario - Categorías')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('inventory/categories')
export class InventoryCategoriesController {
  constructor(
    private readonly listCategories: ListCategoriesUseCase,
    private readonly saveCategory: SaveCategoryUseCase,
    private readonly deleteCategory: DeleteCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Categorías de inventario' })
  list() {
    return this.listCategories.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Crea una categoría' })
  create(@Body() dto: CategoryDto) {
    return this.saveCategory.execute({ name: dto.name });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renombra una categoría' })
  rename(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.saveCategory.execute({ id, name: dto.name });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una categoría sin ítems' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteCategory.execute(id);
  }
}
