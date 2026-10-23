import { Inject, Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { DocumentType } from '../../domain/catalogs.js';
import type { NumberingResolution } from '../../domain/numbering-resolution.js';
import type { NumberingResolutionRepository } from '../../domain/numbering-resolution.repository.js';
import { NumberingResolutionMapper } from './numbering-resolution.mapper.js';
import { NumberingResolutionOrmEntity } from './numbering-resolution.orm-entity.js';
import { SECRET_CIPHER, type SecretCipher } from './secret-cipher.js';

@Injectable()
export class TypeOrmNumberingResolutionRepository implements NumberingResolutionRepository {
  private readonly mapper: NumberingResolutionMapper;

  constructor(
    private readonly db: TenantDataSource,
    @Inject(SECRET_CIPHER) cipher: SecretCipher,
  ) {
    this.mapper = new NumberingResolutionMapper(cipher);
  }

  async findById(id: number): Promise<NumberingResolution | null> {
    const row = await (await this.db.repository(NumberingResolutionOrmEntity)).findOneBy({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(): Promise<NumberingResolution[]> {
    const rows = await (
      await this.db.repository(NumberingResolutionOrmEntity)
    ).find({
      order: { isActive: 'DESC', docType: 'ASC', id: 'DESC' },
    });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findActive(docType: DocumentType): Promise<NumberingResolution | null> {
    const row = await (
      await this.db.repository(NumberingResolutionOrmEntity)
    ).findOne({
      where: { docType, isActive: true },
      order: { id: 'DESC' },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async lockActive(docType: DocumentType): Promise<NumberingResolution | null> {
    const row = await (
      await this.db.repository(NumberingResolutionOrmEntity)
    )
      .createQueryBuilder('c')
      .where('c.doc_type = :docType AND c.is_active = true', { docType })
      .orderBy('c.id', 'DESC')
      .setLock('pessimistic_write')
      .getOne();
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByPrefix(prefix: string): Promise<NumberingResolution[]> {
    const rows = await (await this.db.repository(NumberingResolutionOrmEntity)).findBy({ prefix });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async save(resolution: NumberingResolution): Promise<void> {
    const saved = await (
      await this.db.repository(NumberingResolutionOrmEntity)
    ).save(this.mapper.toPersistence(resolution));
    if (resolution.isNew) resolution.assignId(saved.id);
  }
}
