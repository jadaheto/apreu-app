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
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ChangeThirdPartyStatusUseCase } from '../../application/change-third-party-status.use-case.js';
import { CreateThirdPartyUseCase } from '../../application/create-third-party.use-case.js';
import { DeleteThirdPartyUseCase } from '../../application/delete-third-party.use-case.js';
import { ListThirdPartiesUseCase } from '../../application/list-third-parties.use-case.js';
import { UpdateThirdPartyUseCase } from '../../application/update-third-party.use-case.js';
import { ACCOUNTING_ROLES } from './accounting-roles.js';
import { ListThirdPartiesQueryDto, ThirdPartyDto } from './dto/third-party.dto.js';

@ApiTags('Contabilidad - Terceros')
@ApiBearerAuth()
@Roles(...ACCOUNTING_ROLES)
@Controller('accounting/third-parties')
export class ThirdPartiesController {
  constructor(
    private readonly listThirdParties: ListThirdPartiesUseCase,
    private readonly createThirdParty: CreateThirdPartyUseCase,
    private readonly updateThirdParty: UpdateThirdPartyUseCase,
    private readonly changeStatus: ChangeThirdPartyStatusUseCase,
    private readonly deleteThirdParty: DeleteThirdPartyUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Busca terceros por nombre o documento' })
  list(@Query() query: ListThirdPartiesQueryDto) {
    return this.listThirdParties.execute({
      search: query.search,
      isActive: query.isActive,
      page: query.toPageRequest(),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Registra un tercero (calcula el DV del NIT)' })
  create(@Body() dto: ThirdPartyDto) {
    return this.createThirdParty.execute(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un tercero' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ThirdPartyDto) {
    return this.updateThirdParty.execute({ id, ...dto });
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inactiva un tercero' })
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.changeStatus.execute({ id, active: false });
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactiva un tercero' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.changeStatus.execute({ id, active: true });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un tercero sin movimientos' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteThirdParty.execute(id);
  }
}
