import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  MarketingCriteria,
  MarketingGenerationRepository,
} from '../../domain/ai/marketing-generation.repository.js';
import type { MarketingGeneration } from '../../domain/ai/marketing-generation.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { likeTerm } from './like.js';
import { MarketingGenerationMapper } from './mappers.js';
import { MarketingCampaignOrmEntity } from './orm-entities.js';

@Injectable()
export class TypeOrmMarketingGenerationRepository implements MarketingGenerationRepository {
  constructor(private readonly db: TenantDataSource) {}

  async save(generation: MarketingGeneration): Promise<void> {
    const saved = await (
      await this.db.repository(MarketingCampaignOrmEntity)
    ).save(MarketingGenerationMapper.toPersistence(generation));
    if (generation.isNew) generation.assignId(saved.id);
  }

  async search(criteria: MarketingCriteria, page: PageRequest): Promise<Paginated<MarketingGeneration>> {
    const query = (await this.db.repository(MarketingCampaignOrmEntity))
      .createQueryBuilder('m')
      .where('m.user_id = :userId', { userId: criteria.userId });
    if (criteria.type) query.andWhere('m.campaign_type = :type', { type: criteria.type });
    if (criteria.date) query.andWhere('CAST(m.created_at AS date) = :date', { date: criteria.date });
    if (criteria.search) {
      const term = likeTerm(criteria.search);
      query.andWhere(
        new Brackets((q) =>
          q.where(unaccentLike('m.context_input', ':term'), { term }).orWhere(unaccentLike('m.ai_response', ':term')),
        ),
      );
    }
    const [rows, total] = await query
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(MarketingGenerationMapper.toDomain), total, page: page.page, limit: page.limit };
  }
}
