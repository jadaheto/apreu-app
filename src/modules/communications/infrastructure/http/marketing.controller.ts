import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import {
  GenerateMarketingContentUseCase,
  ListMarketingTypesUseCase,
  ListMyMarketingGenerationsUseCase,
} from '../../application/ai/marketing.use-cases.js';
import { GenerateMarketingDto, MarketingHistoryQueryDto } from './dto/ai.dto.js';

/** Marketing content generated with AI; each user sees only their own history. */
@ApiTags('Marketing IA')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.EMPLOYEE)
@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly types: ListMarketingTypesUseCase,
    private readonly generate: GenerateMarketingContentUseCase,
    private readonly history: ListMyMarketingGenerationsUseCase,
  ) {}

  @Get('types')
  @ApiOperation({ summary: 'Catálogo de generadores' })
  listTypes() {
    return this.types.execute();
  }

  @Post('generations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Genera contenido de marketing con IA' })
  create(@CurrentActor() actor: AuthenticatedActor, @Body() dto: GenerateMarketingDto) {
    return this.generate.execute({ actor, type: dto.type, context: dto.context });
  }

  @Get('generations')
  @ApiOperation({ summary: 'Mi historial de generaciones (filtros: tipo, fecha, texto)' })
  list(@CurrentActor() actor: AuthenticatedActor, @Query() query: MarketingHistoryQueryDto) {
    return this.history.execute({
      userId: actor.userId,
      type: query.type,
      date: query.date,
      search: query.search,
      page: query.toPageRequest(),
    });
  }
}
