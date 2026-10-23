import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  ChatExchangeRepository,
  ChatLogCriteria,
  ChatLogRecord,
} from '../../domain/ai/chat-exchange.repository.js';
import type { ChatExchange } from '../../domain/ai/chat-exchange.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { likeTerm } from './like.js';
import { ChatExchangeMapper } from './mappers.js';
import { ChatLogOrmEntity } from './orm-entities.js';

@Injectable()
export class TypeOrmChatExchangeRepository implements ChatExchangeRepository {
  constructor(private readonly db: TenantDataSource) {}

  async save(exchange: ChatExchange): Promise<void> {
    const saved = await (await this.db.repository(ChatLogOrmEntity)).save(ChatExchangeMapper.toPersistence(exchange));
    if (exchange.isNew) exchange.assignId(saved.id);
  }

  async search(criteria: ChatLogCriteria, page: PageRequest): Promise<Paginated<ChatLogRecord>> {
    const query = (await this.db.repository(ChatLogOrmEntity))
      .createQueryBuilder('l')
      .leftJoin('users', 'u', 'u.id = l.user_id')
      .addSelect('u.name', 'user_name')
      .addSelect('u.email', 'user_email');
    if (criteria.userId !== undefined) query.andWhere('l.user_id = :userId', { userId: criteria.userId });
    if (criteria.role) query.andWhere('l.role = :role', { role: criteria.role });
    if (criteria.from) query.andWhere('CAST(l.created_at AS date) >= :from', { from: criteria.from });
    if (criteria.to) query.andWhere('CAST(l.created_at AS date) <= :to', { to: criteria.to });
    if (criteria.search) {
      const term = likeTerm(criteria.search);
      query.andWhere(
        new Brackets((q) =>
          q.where(unaccentLike('l.user_message', ':term'), { term }).orWhere(unaccentLike('u.name', ':term')),
        ),
      );
    }
    const total = await query.clone().getCount();
    const { entities, raw } = await query
      .orderBy('l.created_at', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .offset(toOffset(page))
      .limit(page.limit)
      .getRawAndEntities<{ user_name: string | null; user_email: string | null }>();
    return {
      items: entities.map((row, index) => ({
        exchange: ChatExchangeMapper.toDomain(row),
        userName: raw[index]?.user_name ?? null,
        userEmail: raw[index]?.user_email ?? null,
      })),
      total,
      page: page.page,
      limit: page.limit,
    };
  }
}
