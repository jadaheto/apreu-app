import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { Guardian } from '../../domain/guardian.js';
import type { GuardianRepository } from '../../domain/guardian.repository.js';
import { GuardianOrmEntity } from './guardian.orm-entity.js';
import { GuardianMapper } from './mappers.js';

/** TypeORM adapter of {@link GuardianRepository}. */
@Injectable()
export class TypeOrmGuardianRepository implements GuardianRepository {
  constructor(private readonly db: TenantDataSource) {}

  private repository() {
    return this.db.repository(GuardianOrmEntity);
  }

  async findById(id: number): Promise<Guardian | null> {
    const row = await (await this.repository()).findOneBy({ id });
    return row ? GuardianMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<Guardian[]> {
    if (ids.length === 0) return [];
    return (await (await this.repository()).findBy({ id: In(ids) })).map(GuardianMapper.toDomain);
  }

  /** Case-insensitive (ADR-0008), as MariaDB's `utf8mb4_general_ci` was. */
  async findByDocumentNumber(documentNumber: string): Promise<Guardian | null> {
    const row = await (
      await this.repository()
    )
      .createQueryBuilder('g')
      .where('upper(g.document_number) = upper(:documentNumber)', { documentNumber: documentNumber.trim() })
      .orderBy('g.id', 'ASC')
      .getOne();
    return row ? GuardianMapper.toDomain(row) : null;
  }

  async findByUserId(userId: number): Promise<Guardian | null> {
    const row = await (await this.repository()).findOneBy({ userId });
    return row ? GuardianMapper.toDomain(row) : null;
  }

  async save(guardian: Guardian): Promise<void> {
    const saved = await (await this.repository()).save(GuardianMapper.toPersistence(guardian));
    if (guardian.isNew) guardian.assignId(saved.id);
  }
}
