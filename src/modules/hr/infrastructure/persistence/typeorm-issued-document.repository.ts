import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import {
  ISSUED_DOCUMENT_TYPES,
  IssuedDocument,
  type IssuedDocumentRepository,
} from '../../domain/documents/issued-document.js';
import { enumValue } from './enum-value.js';
import { IssuedDocumentOrmEntity } from './issued-document.orm-entity.js';

/** TypeORM adapter of {@link IssuedDocumentRepository}. */
@Injectable()
export class TypeOrmIssuedDocumentRepository implements IssuedDocumentRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findByCode(code: string): Promise<IssuedDocument | null> {
    const row = await (await this.db.repository(IssuedDocumentOrmEntity)).findOneBy({ code });
    if (!row) return null;
    return IssuedDocument.restore(row.id, {
      code: row.code,
      type: enumValue(row.type, ISSUED_DOCUMENT_TYPES, 'employment_certificate'),
      employeeId: row.employeeId,
      content: row.content,
      issuedBy: row.issuedBy ?? 0,
      issuedAt: row.issuedAt,
    });
  }

  async save(document: IssuedDocument<object>): Promise<void> {
    const row = new IssuedDocumentOrmEntity();
    Object.assign(row, {
      code: document.code,
      type: document.type,
      employeeId: document.employeeId,
      content: document.content,
      issuedBy: document.issuedBy,
      issuedAt: document.issuedAt,
    });
    const saved = await (await this.db.repository(IssuedDocumentOrmEntity)).save(row);
    if (document.isNew) document.assignId(saved.id);
  }
}
