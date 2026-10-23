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
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { SELF_SERVICE_ROLES } from '../../application/hr-access.js';
import { CreateStickerUseCase } from '../../application/stickers/create-sticker.use-case.js';
import { DeleteStickerUseCase } from '../../application/stickers/delete-sticker.use-case.js';
import { GetStickerStatsUseCase } from '../../application/stickers/get-sticker-stats.use-case.js';
import { ListMyPendingStickersUseCase } from '../../application/stickers/list-my-pending-stickers.use-case.js';
import { ListStickersUseCase } from '../../application/stickers/list-stickers.use-case.js';
import { MarkStickerReadUseCase } from '../../application/stickers/mark-sticker-read.use-case.js';
import { CreateStickerDto, ListStickersQueryDto } from './dto/sticker.dto.js';

/**
 * Stickers/notes for employees (legacy `stickers/index.php`, `mark_read.php`,
 * footer pop-up). Visibility and ownership are enforced in the use cases.
 */
@ApiTags('Stickers')
@ApiBearerAuth()
@Roles(...SELF_SERVICE_ROLES)
@Controller('stickers')
export class StickersController {
  constructor(
    private readonly listStickers: ListStickersUseCase,
    private readonly getStats: GetStickerStatsUseCase,
    private readonly listPending: ListMyPendingStickersUseCase,
    private readonly createSticker: CreateStickerUseCase,
    private readonly markRead: MarkStickerReadUseCase,
    private readonly deleteSticker: DeleteStickerUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Stickers visibles (admin/RR. HH.: todos; demás: propios o creados)' })
  list(@CurrentActor() actor: AuthenticatedActor, @Query() query: ListStickersQueryDto) {
    return this.listStickers.execute({
      actor,
      filter: query.filter ?? 'all',
      employeeId: query.employeeId,
      page: query.toPageRequest(),
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Totales, no leídos y urgentes' })
  stats(@CurrentActor() actor: AuthenticatedActor) {
    return this.getStats.execute(actor);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Mis stickers no leídos para el aviso emergente (máx. 5)' })
  pending(@CurrentActor() actor: AuthenticatedActor) {
    return this.listPending.execute(actor);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un sticker (admin/RR. HH. a cualquiera; demás solo a sí mismos)' })
  create(@CurrentActor() actor: AuthenticatedActor, @Body() dto: CreateStickerDto) {
    return this.createSticker.execute({ actor, ...dto });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca un sticker como leído (destinatario o admin/RR. HH.)' })
  read(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.markRead.execute({ actor, stickerId: id });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un sticker (autor o admin/RR. HH.)' })
  async remove(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteSticker.execute({ actor, stickerId: id });
  }
}
