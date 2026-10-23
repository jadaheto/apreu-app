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
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateJournalEntryUseCase } from '../../application/create-journal-entry.use-case.js';
import { DeleteDraftJournalEntryUseCase } from '../../application/delete-draft-journal-entry.use-case.js';
import { GetJournalEntryUseCase } from '../../application/get-journal-entry.use-case.js';
import { ListJournalEntriesUseCase } from '../../application/list-journal-entries.use-case.js';
import { PostJournalEntryUseCase } from '../../application/post-journal-entry.use-case.js';
import { ReverseJournalEntryUseCase } from '../../application/reverse-journal-entry.use-case.js';
import { UpdateDraftJournalEntryUseCase } from '../../application/update-draft-journal-entry.use-case.js';
import { VoidJournalEntryUseCase } from '../../application/void-journal-entry.use-case.js';
import { ACCOUNTING_ROLES } from './accounting-roles.js';
import {
  CreateJournalEntryDto,
  JournalEntryDto,
  ListJournalEntriesQueryDto,
  ReverseJournalEntryDto,
} from './dto/journal-entry.dto.js';
import { ReasonDto } from './dto/period.dto.js';

@ApiTags('Contabilidad - Asientos')
@ApiBearerAuth()
@Roles(...ACCOUNTING_ROLES)
@Controller('accounting/journal-entries')
export class JournalEntriesController {
  constructor(
    private readonly listEntries: ListJournalEntriesUseCase,
    private readonly getEntry: GetJournalEntryUseCase,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly updateDraft: UpdateDraftJournalEntryUseCase,
    private readonly deleteDraft: DeleteDraftJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase,
    private readonly voidEntry: VoidJournalEntryUseCase,
    private readonly reverseEntry: ReverseJournalEntryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista asientos por rango, tipo y estado' })
  list(@Query() query: ListJournalEntriesQueryDto) {
    const { from, to, type, status } = query;
    return this.listEntries.execute({ from, to, type, status, page: query.toPageRequest() });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del asiento con sus líneas' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.getEntry.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un asiento (contabilizado o borrador) con partida doble validada' })
  create(@Body() dto: CreateJournalEntryDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.createEntry.execute({ ...dto, actor });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita un asiento en borrador' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: JournalEntryDto) {
    return this.updateDraft.execute({ id, ...dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un asiento en borrador' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteDraft.execute(id);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Contabiliza un borrador (asigna consecutivo)' })
  post(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: AuthenticatedActor) {
    return this.postEntry.execute({ id, actor });
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula un asiento contabilizado de un periodo abierto' })
  void(@Param('id', ParseIntPipe) id: number, @Body() dto: ReasonDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.voidEntry.execute({ id, reason: dto.reason, actor });
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revierte un asiento con un contra-asiento' })
  reverse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.reverseEntry.execute({ id, ...dto, actor });
  }
}
