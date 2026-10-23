import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { AskAssistantUseCase } from '../../application/ai/ask-assistant.use-case.js';
import { ListChatLogsUseCase, ListMyChatHistoryUseCase } from '../../application/ai/list-chat-history.use-cases.js';
import { AskAssistantDto, ChatLogsQueryDto } from './dto/ai.dto.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';

/** AI assistant chat (floating widget), personal history and global monitor. */
@ApiTags('Asistente IA')
@ApiBearerAuth()
@Controller('ai/chat')
export class AiAssistantController {
  constructor(
    private readonly ask: AskAssistantUseCase,
    private readonly myHistory: ListMyChatHistoryUseCase,
    private readonly logs: ListChatLogsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Pregunta al asistente IA (máx. 20 mensajes por minuto)' })
  chat(@CurrentActor() actor: AuthenticatedActor, @Body() dto: AskAssistantDto) {
    return this.ask.execute({ actor, message: dto.message });
  }

  @Get('history')
  @ApiOperation({ summary: 'Mi historial de conversaciones' })
  history(@CurrentActor() actor: AuthenticatedActor, @Query() query: PaginationQueryDto) {
    return this.myHistory.execute({ userId: actor.userId, page: query.toPageRequest() });
  }

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Monitor global de conversaciones del colegio' })
  monitor(@Query() query: ChatLogsQueryDto) {
    return this.logs.execute({
      criteria: { role: query.role, from: query.from, to: query.to, search: query.search },
      page: query.toPageRequest(),
    });
  }
}
