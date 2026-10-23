import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { MarketingGeneration, MarketingType } from './marketing-generation.js';

export interface MarketingCriteria {
  /** Always restricted to the author (RN-COM-15). */
  userId: number;
  type?: MarketingType;
  /** `YYYY-MM-DD` creation day. */
  date?: string;
  /** Matches the context or the AI response. */
  search?: string;
}

/** Output port for `ai_marketing_campaigns`. */
export interface MarketingGenerationRepository {
  save(generation: MarketingGeneration): Promise<void>;
  /** Newest first. */
  search(criteria: MarketingCriteria, page: PageRequest): Promise<Paginated<MarketingGeneration>>;
}

export const MARKETING_GENERATION_REPOSITORY = Symbol('MarketingGenerationRepository');
