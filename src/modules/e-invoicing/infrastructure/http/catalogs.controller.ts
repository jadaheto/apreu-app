import { Controller, Get, Param, ParseEnumPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CATALOG_NAMES, type CatalogName, GetCatalogUseCase } from '../../application/get-catalog.use-case.js';

const CATALOG_ENUM = Object.fromEntries(CATALOG_NAMES.map((name) => [name, name]));

/** DIAN and DANE code lists used by the e-invoicing forms. */
@ApiTags('Facturación electrónica · Catálogos')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FINANCE)
@Controller('e-invoicing/catalogs')
export class CatalogsController {
  constructor(private readonly catalogs: GetCatalogUseCase) {}

  @Get('dane/departments/:code/cities')
  @ApiOperation({ summary: 'Municipios DANE de un departamento' })
  cities(@Param('code') code: string) {
    return this.catalogs.execute({ name: 'dane-cities', departmentCode: code });
  }

  @Get(':name')
  @ApiParam({ name: 'name', enum: CATALOG_NAMES })
  @ApiOperation({ summary: 'Catálogo DIAN/DANE (tipos de documento, medios de pago, conceptos de notas…)' })
  show(@Param('name', new ParseEnumPipe(CATALOG_ENUM)) name: CatalogName) {
    return this.catalogs.execute({ name });
  }
}
