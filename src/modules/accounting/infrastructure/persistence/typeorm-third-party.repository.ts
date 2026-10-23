import { Injectable } from '@nestjs/common';
import { Brackets, In } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ThirdParty } from '../../domain/third-party.js';
import type { ThirdPartyRepository, ThirdPartySearchCriteria } from '../../domain/third-party.repository.js';
import { ThirdPartyMapper } from './accounting.mappers.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';
import { ThirdPartyOrmEntity } from './third-party.orm-entity.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';

@Injectable()
export class TypeOrmThirdPartyRepository implements ThirdPartyRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<ThirdParty | null> {
    const row = await (await this.db.repository(ThirdPartyOrmEntity)).findOneBy({ id });
    return row ? ThirdPartyMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<ThirdParty[]> {
    if (ids.length === 0) return [];
    const rows = await (await this.db.repository(ThirdPartyOrmEntity)).findBy({ id: In(ids) });
    return rows.map(ThirdPartyMapper.toDomain);
  }

  /** Case-insensitive (ADR-0008), as MariaDB's `utf8mb4_general_ci` was. */
  async findByDocumentNumber(documentNumber: string): Promise<ThirdParty | null> {
    const row = await (
      await this.db.repository(ThirdPartyOrmEntity)
    )
      .createQueryBuilder('t')
      .where('upper(t.document_number) = upper(:documentNumber)', { documentNumber: documentNumber.trim() })
      .orderBy('t.id', 'ASC')
      .getOne();
    return row ? ThirdPartyMapper.toDomain(row) : null;
  }

  async search(criteria: ThirdPartySearchCriteria, page: PageRequest): Promise<Paginated<ThirdParty>> {
    const query = (await this.db.repository(ThirdPartyOrmEntity)).createQueryBuilder('t');
    if (criteria.isActive !== undefined) query.andWhere('t.is_active = :active', { active: criteria.isActive });
    if (criteria.search?.trim()) {
      const term = `%${criteria.search.trim()}%`;
      query.andWhere(
        new Brackets((q) =>
          q
            .where(unaccentLike('t.name', ':term'), { term })
            .orWhere(unaccentLike('t.document_number', ':term'), { term }),
        ),
      );
    }
    const [rows, total] = await query.orderBy('t.name', 'ASC').skip(toOffset(page)).take(page.limit).getManyAndCount();
    return { items: rows.map(ThirdPartyMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async hasMovements(id: number): Promise<boolean> {
    return (await this.db.repository(JournalLineOrmEntity)).exists({ where: { thirdPartyId: id } });
  }

  async save(party: ThirdParty): Promise<void> {
    const saved = await (await this.db.repository(ThirdPartyOrmEntity)).save(ThirdPartyMapper.toPersistence(party));
    if (party.isNew) party.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(ThirdPartyOrmEntity)).delete({ id });
  }
}
