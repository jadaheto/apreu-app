import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  WhatsAppKpis,
  WhatsAppLogCriteria,
  WhatsAppLogRecord,
  WhatsAppLogRepository,
} from '../../domain/whatsapp/whatsapp-log.repository.js';
import type { WhatsAppLog } from '../../domain/whatsapp/whatsapp-log.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';
import { likeTerm } from './like.js';
import { WhatsAppLogMapper } from './mappers.js';
import { WhatsAppLogOrmEntity } from './orm-entities.js';

@Injectable()
export class TypeOrmWhatsAppLogRepository implements WhatsAppLogRepository {
  constructor(private readonly db: TenantDataSource) {}

  async save(log: WhatsAppLog): Promise<void> {
    const saved = await (await this.db.repository(WhatsAppLogOrmEntity)).save(WhatsAppLogMapper.toPersistence(log));
    if (log.isNew) log.assignId(saved.id);
  }

  async findByMessageId(messageId: string): Promise<WhatsAppLog | null> {
    const row = await (await this.db.repository(WhatsAppLogOrmEntity)).findOneBy({ waMessageId: messageId });
    return row ? WhatsAppLogMapper.toDomain(row) : null;
  }

  async search(criteria: WhatsAppLogCriteria, page: PageRequest): Promise<Paginated<WhatsAppLogRecord>> {
    const query = (await this.db.repository(WhatsAppLogOrmEntity))
      .createQueryBuilder('w')
      .leftJoin('students', 's', 's.id = w.student_id')
      .addSelect("CONCAT(s.first_name, ' ', s.last_name)", 'student_name');
    if (criteria.status) query.andWhere('w.status = :status', { status: criteria.status });
    if (criteria.search) {
      const term = likeTerm(criteria.search);
      query.andWhere(
        new Brackets((q) => q.where('w.phone ILIKE :term', { term }).orWhere(unaccentLike('w.template_name', ':term'))),
      );
    }
    const total = await query.clone().getCount();
    const { entities, raw } = await query
      .orderBy('w.created_at', 'DESC')
      .addOrderBy('w.id', 'DESC')
      .offset(toOffset(page))
      .limit(page.limit)
      .getRawAndEntities<{ student_name: string | null }>();
    return {
      items: entities.map((row, index) => ({
        log: WhatsAppLogMapper.toDomain(row),
        studentName: raw[index]?.student_name ?? null,
      })),
      total,
      page: page.page,
      limit: page.limit,
    };
  }

  async kpis(): Promise<WhatsAppKpis> {
    const rows: { status: keyof WhatsAppKpis; total: string }[] = await (
      await this.db.manager()
    ).query('SELECT status, COUNT(*)::int AS total FROM whatsapp_log GROUP BY status');
    const kpis: WhatsAppKpis = { sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const row of rows) if (row.status in kpis) kpis[row.status] = Number(row.total);
    return kpis;
  }
}
