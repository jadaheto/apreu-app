import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { BillingConcept } from '../../domain/billing-concept.js';
import type { BillingConceptRepository } from '../../domain/billing-concept.repository.js';
import { BillingConceptOrmEntity } from './billing-concept.orm-entity.js';
import { BillingConceptMapper } from './finance.mappers.js';

@Injectable()
export class TypeOrmBillingConceptRepository implements BillingConceptRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<BillingConcept | null> {
    const row = await (await this.db.repository(BillingConceptOrmEntity)).findOneBy({ id });
    return row ? BillingConceptMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<BillingConcept[]> {
    if (ids.length === 0) return [];
    const rows = await (await this.db.repository(BillingConceptOrmEntity)).findBy({ id: In(ids) });
    return rows.map(BillingConceptMapper.toDomain);
  }

  async list(filter: { active?: boolean }): Promise<BillingConcept[]> {
    const rows = await (
      await this.db.repository(BillingConceptOrmEntity)
    ).find({
      where: filter.active === undefined ? {} : { isActive: filter.active },
      order: { isActive: 'DESC', category: 'ASC', name: 'ASC' },
    });
    return rows.map(BillingConceptMapper.toDomain);
  }

  async save(concept: BillingConcept): Promise<void> {
    const saved = await (
      await this.db.repository(BillingConceptOrmEntity)
    ).save(BillingConceptMapper.toPersistence(concept));
    if (concept.isNew) concept.assignId(saved.id);
  }
}
