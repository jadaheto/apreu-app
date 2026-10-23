import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import {
  CreateWhatsAppTemplateUseCase,
  DeleteWhatsAppTemplateUseCase,
  GetWhatsAppTemplateUseCase,
  ListWhatsAppTemplatesUseCase,
  UpdateWhatsAppTemplateUseCase,
} from '../../application/whatsapp/manage-whatsapp-templates.use-cases.js';
import type { WhatsAppTemplateData } from '../../domain/whatsapp/whatsapp-template.js';
import { TemplatesQueryDto, WhatsAppTemplateDto } from './dto/whatsapp.dto.js';

const toTemplateData = (dto: WhatsAppTemplateDto): WhatsAppTemplateData => ({
  name: dto.name,
  metaTemplateId: dto.metaTemplateId ?? null,
  language: dto.language,
  category: dto.category,
  body: dto.body,
  variables: dto.variables,
  status: dto.status,
  headerType: dto.headerType,
  headerText: dto.headerText ?? null,
  headerImageUrl: dto.headerImageUrl ?? null,
  footerText: dto.footerText ?? null,
  buttons: dto.buttons ?? [],
});

/** WhatsApp templates: read for back-office staff, write for administrators only (legacy bug #2). */
@ApiTags('Comunicaciones · Plantillas WhatsApp')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR, Role.FINANCE)
@Controller('communications/whatsapp/templates')
export class WhatsAppTemplatesController {
  constructor(
    private readonly listTemplates: ListWhatsAppTemplatesUseCase,
    private readonly getTemplate: GetWhatsAppTemplateUseCase,
    private readonly createTemplate: CreateWhatsAppTemplateUseCase,
    private readonly updateTemplate: UpdateWhatsAppTemplateUseCase,
    private readonly deleteTemplate: DeleteWhatsAppTemplateUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista las plantillas (filtro opcional por estado)' })
  list(@Query() query: TemplatesQueryDto) {
    return this.listTemplates.execute({ status: query.status });
  }

  @Get('by-name/:name')
  @ApiOperation({ summary: 'Obtiene una plantilla por nombre' })
  byName(@Param('name') name: string) {
    return this.getTemplate.execute({ name });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una plantilla' })
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.getTemplate.execute({ id });
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crea una plantilla' })
  create(@Body() dto: WhatsAppTemplateDto) {
    return this.createTemplate.execute(toTemplateData(dto));
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualiza una plantilla' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: WhatsAppTemplateDto) {
    return this.updateTemplate.execute({ id, data: toTemplateData(dto) });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una plantilla' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteTemplate.execute(id);
  }
}
