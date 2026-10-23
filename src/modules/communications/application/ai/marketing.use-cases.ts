import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { mapPage, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import {
  MARKETING_GENERATION_REPOSITORY,
  type MarketingGenerationRepository,
} from '../../domain/ai/marketing-generation.repository.js';
import {
  MARKETING_CATALOG,
  MarketingGeneration,
  type MarketingType,
  type MarketingTypeInfo,
} from '../../domain/ai/marketing-generation.js';
import { assertDay, bogotaDay } from '../../domain/common/format.js';
import { AI_CONTEXT, type AiContextPort } from '../../domain/directory/ai-context.port.js';
import { MARKETING_GENERATOR, type MarketingGeneratorPort } from '../ports/ai-gateway.port.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { type MarketingGenerationView, toMarketingGenerationView } from '../views.js';

/** The six generators of the marketing menu (legacy `marketing/index.php`). */
@Injectable()
export class ListMarketingTypesUseCase implements UseCase<void, readonly MarketingTypeInfo[]> {
  async execute(): Promise<readonly MarketingTypeInfo[]> {
    return MARKETING_CATALOG;
  }
}

export interface GenerateMarketingInput {
  actor: AuthenticatedActor;
  type: MarketingType;
  context: string;
}

/**
 * Generates marketing content with the n8n flow (legacy
 * `marketing/generate.php`, RN-COM-15). The CRM data sent is limited to the
 * active student count and today's date; the result is stored for its author.
 */
@Injectable()
export class GenerateMarketingContentUseCase implements UseCase<GenerateMarketingInput, MarketingGenerationView> {
  constructor(
    @Inject(MARKETING_GENERATOR) private readonly generator: MarketingGeneratorPort,
    @Inject(MARKETING_GENERATION_REPOSITORY) private readonly generations: MarketingGenerationRepository,
    @Inject(AI_CONTEXT) private readonly context: AiContextPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly settings: CommunicationSettings,
  ) {}

  async execute({ actor, type, context }: GenerateMarketingInput): Promise<MarketingGenerationView> {
    const contexto = MarketingGeneration.assertValidRequest(type, context);
    const { marketing } = await this.settings.ai();
    if (!marketing) {
      throw new BusinessRuleViolationError(
        'El Webhook de Marketing IA no está configurado. Ve a Configuración > Apreu AI.',
        'MARKETING_AI_NOT_CONFIGURED',
      );
    }
    const now = this.clock.now();
    const crm = { total_estudiantes_activos: await this.context.activeStudentCount(), fecha_actual: bogotaDay(now) };
    const { schoolName } = await this.settings.branding();

    const response = await this.generator.generate(marketing, {
      tipo: type,
      contexto,
      institucion: schoolName,
      datos_crm: crm,
      userId: actor.userId,
      tenant: actor.tenant,
    });

    const generation = MarketingGeneration.record(
      { userId: actor.userId, type, contextInput: contexto, crmData: crm, aiResponse: response },
      now,
    );
    await this.generations.save(generation);
    return toMarketingGenerationView(generation);
  }
}

export interface ListMyMarketingInput {
  userId: number;
  type?: MarketingType;
  date?: string;
  search?: string;
  page: PageRequest;
}

/** The author's own generations with filters (legacy `marketing/history.php`). */
@Injectable()
export class ListMyMarketingGenerationsUseCase implements UseCase<
  ListMyMarketingInput,
  Paginated<MarketingGenerationView>
> {
  constructor(@Inject(MARKETING_GENERATION_REPOSITORY) private readonly generations: MarketingGenerationRepository) {}

  async execute({ page, ...criteria }: ListMyMarketingInput): Promise<Paginated<MarketingGenerationView>> {
    if (criteria.date) assertDay(criteria.date, 'fecha');
    return mapPage(await this.generations.search(criteria, page), toMarketingGenerationView);
  }
}
