import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetSettingsCatalogUseCase } from '../../application/get-settings-catalog.use-case.js';
import { GetSettingsSectionUseCase } from '../../application/get-settings-section.use-case.js';
import { UpdateSettingsSectionUseCase } from '../../application/update-settings-section.use-case.js';
import {
  SettingsSectionMetadataDto,
  SettingsSectionResponseDto,
  UpdateSettingsSectionDto,
} from './dto/settings.dto.js';

const SECTION_PARAM = {
  name: 'section',
  enum: ['academic', 'invoice-email', 'payments', 'payroll', 'branding', 'modules', 'integrations', 'ai'],
};

/**
 * Configuration tabs. Access per section is decided by the use case:
 * admin all; finance `dian` and `payments`; HR `payroll`.
 */
@ApiTags('Configuración')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FINANCE, Role.HR)
@Controller('institution/settings')
export class SettingsController {
  constructor(
    private readonly catalog: GetSettingsCatalogUseCase,
    private readonly getSection: GetSettingsSectionUseCase,
    private readonly updateSection: UpdateSettingsSectionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Secciones y campos tipados que el usuario puede configurar' })
  @ApiOkResponse({ type: [SettingsSectionMetadataDto] })
  sections(@CurrentActor() actor: AuthenticatedActor) {
    return this.catalog.execute(actor.role);
  }

  @Get(':section')
  @ApiParam(SECTION_PARAM)
  @ApiOperation({ summary: 'Valores de una sección (secretos enmascarados)' })
  @ApiOkResponse({ type: SettingsSectionResponseDto })
  read(@CurrentActor() actor: AuthenticatedActor, @Param('section') section: string) {
    return this.getSection.execute({ role: actor.role, section });
  }

  @Put(':section')
  @ApiParam(SECTION_PARAM)
  @ApiOperation({ summary: 'Actualiza claves de una sección (actualización parcial)' })
  @ApiOkResponse({ type: SettingsSectionResponseDto })
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('section') section: string,
    @Body() dto: UpdateSettingsSectionDto,
  ) {
    return this.updateSection.execute({ role: actor.role, section, values: dto.values });
  }
}
