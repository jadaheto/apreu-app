import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ListResolutionsUseCase } from '../../application/list-resolutions.use-case.js';
import { RegisterResolutionUseCase } from '../../application/register-resolution.use-case.js';
import { UpdateResolutionUseCase } from '../../application/update-resolution.use-case.js';
import { RegisterResolutionDto, UpdateResolutionDto } from './dto/resolution.dto.js';

/** Numbering resolutions and ranges per document type (`dian_consecutives`). */
@ApiTags('Facturación electrónica · Numeración')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FINANCE)
@Controller('e-invoicing/resolutions')
export class ResolutionsController {
  constructor(
    private readonly listResolutions: ListResolutionsUseCase,
    private readonly registerResolution: RegisterResolutionUseCase,
    private readonly updateResolution: UpdateResolutionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Numeraciones de facturas, notas crédito y notas débito' })
  list() {
    return this.listResolutions.execute();
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Registra una numeración y la activa para su tipo' })
  register(@Body() dto: RegisterResolutionDto) {
    return this.registerResolution.execute(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Amplía, renueva, cambia la clave técnica o (des)activa una numeración' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResolutionDto) {
    return this.updateResolution.execute({ id, ...dto });
  }
}
