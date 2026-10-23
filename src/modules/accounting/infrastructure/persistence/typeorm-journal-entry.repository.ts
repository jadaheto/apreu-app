import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { FindOptionsWhere } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { JournalEntry } from '../../domain/journal-entry.js';
import type { JournalEntryRepository, JournalEntrySearchCriteria } from '../../domain/journal-entry.repository.js';
import { DRAFT_NUMBER_PREFIX, JournalEntryMapper } from './accounting.mappers.js';
import { JournalEntryOrmEntity } from './journal-entry.orm-entity.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';

/**
 * Persists entries with their lines. Callers wrap `save` in a unit of work so
 * header and lines are atomic (bug 5).
 */
@Injectable()
export class TypeOrmJournalEntryRepository implements JournalEntryRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<JournalEntry | null> {
    return this.findOne({ id });
  }

  async findBySource(sourceType: string, sourceId: string): Promise<JournalEntry | null> {
    return this.findOne({ sourceType, sourceId });
  }

  async findReversalOf(entryId: number): Promise<JournalEntry | null> {
    return this.findOne({ reversalOfId: entryId, status: 'posted' });
  }

  async search(criteria: JournalEntrySearchCriteria, page: PageRequest): Promise<Paginated<JournalEntry>> {
    const query = (await this.db.repository(JournalEntryOrmEntity))
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.lines', 'l');
    if (criteria.from) query.andWhere('e.entry_date >= :from', { from: criteria.from });
    if (criteria.to) query.andWhere('e.entry_date <= :to', { to: criteria.to });
    if (criteria.type) query.andWhere('e.entry_type = :type', { type: criteria.type });
    if (criteria.status) query.andWhere('e.status = :status', { status: criteria.status });
    const direction = criteria.order === 'asc' ? 'ASC' : 'DESC';
    const [rows, total] = await query
      .orderBy('e.entryDate', direction)
      .addOrderBy('e.id', direction)
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(JournalEntryMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async countDraftsInPeriod(periodId: number): Promise<number> {
    return (await this.db.repository(JournalEntryOrmEntity)).countBy({ periodId, status: 'draft' });
  }

  async save(entry: JournalEntry): Promise<void> {
    const manager = await this.db.manager();
    const replaceLines = entry.isNew || entry.status === 'draft';
    const saved = await manager.save(JournalEntryMapper.toPersistence(entry, `${DRAFT_NUMBER_PREFIX}${randomUUID()}`));
    if (entry.isNew) entry.assignId(saved.id);
    if (!replaceLines) return;
    await manager.delete(JournalLineOrmEntity, { entryId: saved.id });
    await manager.insert(JournalLineOrmEntity, JournalEntryMapper.linesToPersistence(saved.id, entry));
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(JournalEntryOrmEntity)).delete({ id });
  }

  private async findOne(where: FindOptionsWhere<JournalEntryOrmEntity>): Promise<JournalEntry | null> {
    const row = await (await this.db.repository(JournalEntryOrmEntity)).findOne({ where, relations: { lines: true } });
    return row ? JournalEntryMapper.toDomain(row) : null;
  }
}
