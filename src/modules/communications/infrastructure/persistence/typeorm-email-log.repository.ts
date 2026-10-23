import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  EmailKpis,
  EmailLogCriteria,
  EmailLogRecord,
  EmailLogRepository,
} from '../../domain/email/email-log.repository.js';
import type { EmailLog } from '../../domain/email/email-log.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { likeTerm } from './like.js';
import { EmailLogMapper } from './mappers.js';
import { EmailLogOrmEntity } from './orm-entities.js';

@Injectable()
export class TypeOrmEmailLogRepository implements EmailLogRepository {
  constructor(private readonly db: TenantDataSource) {}

  async save(log: EmailLog): Promise<void> {
    const saved = await (await this.db.repository(EmailLogOrmEntity)).save(EmailLogMapper.toPersistence(log));
    if (log.isNew) log.assignId(saved.id);
  }

  async search(criteria: EmailLogCriteria, page: PageRequest): Promise<Paginated<EmailLogRecord>> {
    const query = (await this.db.repository(EmailLogOrmEntity))
      .createQueryBuilder('e')
      .leftJoin('users', 'u', 'u.id = e.created_by')
      .addSelect('u.name', 'sent_by_name');
    if (criteria.type) query.andWhere('e.type = :type', { type: criteria.type });
    if (criteria.status) query.andWhere('e.status = :status', { status: criteria.status });
    if (criteria.search) {
      const term = likeTerm(criteria.search);
      query.andWhere(
        new Brackets((q) =>
          q
            .where('e.to_email ILIKE :term', { term })
            .orWhere(unaccentLike('e.to_name', ':term'))
            .orWhere(unaccentLike('e.subject', ':term')),
        ),
      );
    }
    const total = await query.clone().getCount();
    const { entities, raw } = await query
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .offset(toOffset(page))
      .limit(page.limit)
      .getRawAndEntities<{ sent_by_name: string | null }>();
    return {
      items: entities.map((row, index) => ({
        log: EmailLogMapper.toDomain(row),
        sentByName: raw[index]?.sent_by_name ?? null,
      })),
      total,
      page: page.page,
      limit: page.limit,
    };
  }

  async kpis(): Promise<EmailKpis> {
    const [row] = await (
      await this.db.manager()
    ).query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE type = 'aviso')::int AS notices,
              COUNT(*) FILTER (WHERE type = 'factura_cobro')::int AS billing,
              COUNT(*) FILTER (WHERE type = 'factura_dian')::int AS dian,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
         FROM email_log`,
    );
    return {
      total: Number(row?.total ?? 0),
      notices: Number(row?.notices ?? 0),
      billing: Number(row?.billing ?? 0),
      dian: Number(row?.dian ?? 0),
      failed: Number(row?.failed ?? 0),
    };
  }
}
